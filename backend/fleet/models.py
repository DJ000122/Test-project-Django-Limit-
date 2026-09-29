from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Upper


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Office(TimestampedModel):
    name = models.CharField(max_length=120)
    city = models.CharField(max_length=120)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                Upper("name"), Upper("city"), name="office_unique_name_city_ci"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.city})"


class Vehicle(TimestampedModel):
    vin = models.CharField("VIN", max_length=17, unique=True)
    license_plate = models.CharField(max_length=16)
    make = models.CharField(max_length=60)
    model = models.CharField(max_length=60)
    year = models.PositiveSmallIntegerField()
    office = models.ForeignKey(
        Office, on_delete=models.PROTECT, related_name="vehicles"
    )
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["make", "model", "vin"]
        constraints = [
            models.UniqueConstraint(
                fields=["license_plate"],
                condition=Q(active=True),
                name="vehicle_unique_active_license_plate",
            ),
        ]
        indexes = [
            models.Index(fields=["office", "active"]),
            models.Index(fields=["make", "model"]),
            models.Index(fields=["license_plate"]),
        ]

    def __str__(self) -> str:
        return f"{self.year} {self.make} {self.model} [{self.license_plate}]"


class Mechanic(TimestampedModel):
    name = models.CharField(max_length=120)
    certification_number = models.CharField(max_length=40, unique=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.certification_number})"


class MaintenanceType(models.TextChoices):
    OIL_CHANGE = "oil_change", "Oil change"
    TIRE_ROTATION = "tire_rotation", "Tire rotation"
    BRAKES = "brakes", "Brake service"
    INSPECTION = "inspection", "Inspection"
    BATTERY = "battery", "Battery"
    TRANSMISSION = "transmission", "Transmission"
    REPAIR = "repair", "Repair"
    OTHER = "other", "Other"


class MaintenanceRecord(TimestampedModel):
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.PROTECT, related_name="maintenance_records"
    )
    mechanic = models.ForeignKey(
        Mechanic, on_delete=models.PROTECT, related_name="maintenance_records"
    )
    date = models.DateField()
    maintenance_type = models.CharField(max_length=32, choices=MaintenanceType.choices)
    cost = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(cost__gte=0), name="maintenance_cost_non_negative"
            ),
        ]
        indexes = [
            models.Index(fields=["vehicle", "-date"]),
            models.Index(fields=["mechanic", "date"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_maintenance_type_display()} on {self.date} ({self.vehicle_id})"
