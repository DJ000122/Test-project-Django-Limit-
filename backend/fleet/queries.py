from datetime import date, timedelta
from decimal import Decimal

from django.db.models import (
    Count,
    DecimalField,
    F,
    IntegerField,
    Max,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle

MONEY = DecimalField(max_digits=14, decimal_places=2)
STALE_AFTER_DAYS = 365


def one_year_before(day: date) -> date:
    try:
        return day.replace(year=day.year - 1)
    except ValueError:  # 29 Feb -> 28 Feb
        return day.replace(year=day.year - 1, day=28)


def last_maintenance_subquery():
    return Subquery(
        MaintenanceRecord.objects.filter(vehicle=OuterRef("pk"))
        .order_by("-date")
        .values("date")[:1]
    )


def vehicle_list_queryset():
    return Vehicle.objects.select_related("office").annotate(
        last_maintenance=last_maintenance_subquery()
    )


def vehicle_detail_queryset():
    history = MaintenanceRecord.objects.select_related("mechanic").order_by("-date", "-id")
    return (
        Vehicle.objects.select_related("office")
        .annotate(
            last_maintenance=Max("maintenance_records__date"),
            maintenance_count=Count("maintenance_records"),
            total_maintenance_cost=Coalesce(
                Sum("maintenance_records__cost"), Value(Decimal("0")), output_field=MONEY
            ),
        )
        .prefetch_related(Prefetch("maintenance_records", queryset=history))
    )


def office_summary_queryset(today: date):
    since = one_year_before(today)

    active_vehicles = (
        Vehicle.objects.filter(office=OuterRef("pk"), active=True)
        .order_by()
        .values("office")
        .annotate(n=Count("pk"))
        .values("n")
    )
    office_records = MaintenanceRecord.objects.filter(vehicle__office=OuterRef("pk")).order_by()
    cost_last_year = (
        office_records.filter(date__gte=since, date__lte=today)
        .values("vehicle__office")
        .annotate(total=Sum("cost"))
        .values("total")
    )
    last_maintenance = office_records.order_by("-date").values("date")[:1]

    return Office.objects.annotate(
        active_vehicle_count=Coalesce(
            Subquery(active_vehicles, output_field=IntegerField()), Value(0)
        ),
        maintenance_cost_last_year=Coalesce(
            Subquery(cost_last_year, output_field=MONEY), Value(Decimal("0")), output_field=MONEY
        ),
        last_maintenance=Subquery(last_maintenance),
    ).order_by("name")


def mechanic_workload_queryset(today: date):
    this_year = Q(
        maintenance_records__date__gte=date(today.year, 1, 1),
        maintenance_records__date__lte=today,
    )
    return (
        Mechanic.objects.annotate(
            records_this_year=Count("maintenance_records", filter=this_year),
            cost_this_year=Coalesce(
                Sum("maintenance_records__cost", filter=this_year),
                Value(Decimal("0")),
                output_field=MONEY,
            ),
        )
        .filter(Q(active=True) | Q(records_this_year__gt=0))
        .order_by("-records_this_year", "-cost_this_year", "name")
    )


def vehicles_needing_maintenance_queryset(today: date):
    cutoff = today - timedelta(days=STALE_AFTER_DAYS)
    return (
        Vehicle.objects.filter(active=True)
        .select_related("office")
        .annotate(last_maintenance=last_maintenance_subquery())
        .filter(Q(last_maintenance__isnull=True) | Q(last_maintenance__lt=cutoff))
        .order_by(F("last_maintenance").asc(nulls_first=True), "id")
    )
