import django_filters
from django.db.models import Exists, OuterRef
from rest_framework.exceptions import ValidationError

from fleet.models import MaintenanceRecord, Mechanic, Vehicle


class VehicleFilter(django_filters.FilterSet):
    office = django_filters.NumberFilter(field_name="office_id")
    active = django_filters.BooleanFilter()
    make = django_filters.CharFilter(lookup_expr="iexact")
    model = django_filters.CharFilter(lookup_expr="iexact")
    maintenance_from = django_filters.DateFilter(method="filter_noop")
    maintenance_to = django_filters.DateFilter(method="filter_noop")
    mechanic_certification = django_filters.CharFilter(method="filter_noop")

    class Meta:
        model = Vehicle
        fields = [
            "office",
            "active",
            "make",
            "model",
            "maintenance_from",
            "maintenance_to",
            "mechanic_certification",
        ]

    def filter_noop(self, queryset, name, value):
        return queryset

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        data = self.form.cleaned_data
        date_from = data.get("maintenance_from")
        date_to = data.get("maintenance_to")
        certification = (data.get("mechanic_certification") or "").strip()

        if date_from and date_to and date_from > date_to:
            raise ValidationError(
                {"maintenance_to": ["maintenance_to must be on or after maintenance_from."]}
            )
        if not (date_from or date_to or certification):
            return queryset

        records = MaintenanceRecord.objects.filter(vehicle=OuterRef("pk"))
        if date_from:
            records = records.filter(date__gte=date_from)
        if date_to:
            records = records.filter(date__lte=date_to)
        if certification:
            mechanic_ids = Mechanic.objects.filter(
                certification_number__iexact=certification
            ).values("pk")
            records = records.filter(mechanic_id__in=mechanic_ids)
        return queryset.filter(Exists(records))


class MaintenanceRecordFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = MaintenanceRecord
        fields = ["vehicle", "mechanic", "maintenance_type", "date_from", "date_to"]


class MechanicFilter(django_filters.FilterSet):
    class Meta:
        model = Mechanic
        fields = ["active"]
