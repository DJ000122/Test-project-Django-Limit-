import re
from datetime import date

from django.utils import timezone
from rest_framework import serializers

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle

VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
MIN_VEHICLE_YEAR = 1900


def normalize_vin(value: str) -> str:
    return (value or "").strip().upper()


def normalize_plate(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", (value or "")).upper()


def vehicle_conflicts(vin, license_plate, *, active=True, exclude_pk=None):
    conflicts = []
    others = Vehicle.objects.all()
    if exclude_pk is not None:
        others = others.exclude(pk=exclude_pk)
    if vin and others.filter(vin=normalize_vin(vin)).exists():
        conflicts.append("vin")
    if (
        license_plate
        and active
        and others.filter(license_plate=normalize_plate(license_plate), active=True).exists()
    ):
        conflicts.append("license_plate")
    return conflicts


class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ["id", "name", "city", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        name = attrs.get("name", getattr(self.instance, "name", "")).strip()
        city = attrs.get("city", getattr(self.instance, "city", "")).strip()
        clash = Office.objects.filter(name__iexact=name, city__iexact=city)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                {"name": [f'An office named "{name}" already exists in {city}.']}
            )
        return attrs


class OfficeBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ["id", "name", "city"]


class OfficeSummarySerializer(serializers.ModelSerializer):
    active_vehicle_count = serializers.IntegerField()
    maintenance_cost_last_year = serializers.DecimalField(max_digits=14, decimal_places=2)
    last_maintenance = serializers.DateField(allow_null=True)

    class Meta:
        model = Office
        fields = [
            "id",
            "name",
            "city",
            "active_vehicle_count",
            "maintenance_cost_last_year",
            "last_maintenance",
        ]


class MechanicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mechanic
        fields = ["id", "name", "certification_number", "active", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_certification_number(self, value):
        value = value.strip().upper()
        clash = Mechanic.objects.filter(certification_number=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                f"A mechanic with certification number {value} already exists."
            )
        return value


class MechanicBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mechanic
        fields = ["id", "name", "certification_number", "active"]


class MechanicWorkloadSerializer(serializers.ModelSerializer):
    records_this_year = serializers.IntegerField()
    cost_this_year = serializers.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        model = Mechanic
        fields = [
            "id",
            "name",
            "certification_number",
            "active",
            "records_this_year",
            "cost_this_year",
        ]


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    maintenance_type_display = serializers.CharField(
        source="get_maintenance_type_display", read_only=True
    )
    mechanic_name = serializers.CharField(source="mechanic.name", read_only=True)
    vehicle_label = serializers.CharField(source="vehicle.__str__", read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "vehicle",
            "vehicle_label",
            "mechanic",
            "mechanic_name",
            "date",
            "maintenance_type",
            "maintenance_type_display",
            "cost",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
        extra_kwargs = {
            "cost": {"min_value": 0},
            "notes": {"required": False, "allow_blank": True},
        }

    def validate_date(self, value: date):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                "Maintenance date cannot be in the future; record work once it has been performed."
            )
        return value

    def validate(self, attrs):
        mechanic = attrs.get("mechanic")
        changing_mechanic = mechanic is not None and (
            self.instance is None or self.instance.mechanic_id != mechanic.pk
        )
        if changing_mechanic and not mechanic.active:
            raise serializers.ValidationError(
                {"mechanic": [f"{mechanic.name} is inactive and cannot be assigned new work."]}
            )
        return attrs


class MaintenanceHistoryItemSerializer(serializers.ModelSerializer):
    mechanic = MechanicBriefSerializer(read_only=True)
    maintenance_type_display = serializers.CharField(
        source="get_maintenance_type_display", read_only=True
    )

    class Meta:
        model = MaintenanceRecord
        fields = [
            "id",
            "date",
            "maintenance_type",
            "maintenance_type_display",
            "cost",
            "notes",
            "mechanic",
        ]
        read_only_fields = fields


class VehicleSerializer(serializers.ModelSerializer):
    office_detail = OfficeBriefSerializer(source="office", read_only=True)
    last_maintenance = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "office",
            "office_detail",
            "active",
            "last_maintenance",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
        extra_kwargs = {"vin": {"validators": []}, "license_plate": {"validators": []}}
        validators = []

    def get_last_maintenance(self, obj):
        value = getattr(obj, "last_maintenance", None)
        return value.isoformat() if value else None

    def validate_vin(self, value):
        value = normalize_vin(value)
        if not VIN_RE.match(value):
            raise serializers.ValidationError(
                "VIN must be exactly 17 letters/digits and cannot contain I, O or Q."
            )
        return value

    def validate_license_plate(self, value):
        value = normalize_plate(value)
        if not value:
            raise serializers.ValidationError("License plate cannot be blank.")
        return value

    def validate_year(self, value):
        max_year = timezone.localdate().year + 1
        if not MIN_VEHICLE_YEAR <= value <= max_year:
            raise serializers.ValidationError(
                f"Year must be between {MIN_VEHICLE_YEAR} and {max_year}."
            )
        return value

    def validate(self, attrs):
        instance = self.instance
        vin = attrs.get("vin", getattr(instance, "vin", None))
        plate = attrs.get("license_plate", getattr(instance, "license_plate", None))
        active = attrs.get("active", getattr(instance, "active", True))

        conflicts = vehicle_conflicts(
            vin, plate, active=active, exclude_pk=instance.pk if instance else None
        )
        errors = {}
        if "vin" in conflicts:
            errors["vin"] = [f"A vehicle with VIN {vin} already exists."]
        if "license_plate" in conflicts:
            errors["license_plate"] = [
                f"License plate {plate} is already used by another active vehicle."
            ]
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class VehicleDetailSerializer(VehicleSerializer):
    office_detail = OfficeBriefSerializer(source="office", read_only=True)
    maintenance_records = MaintenanceHistoryItemSerializer(many=True, read_only=True)
    maintenance_count = serializers.IntegerField(read_only=True)
    total_maintenance_cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta(VehicleSerializer.Meta):
        fields = VehicleSerializer.Meta.fields + [
            "maintenance_count",
            "total_maintenance_cost",
            "maintenance_records",
        ]


class VehicleAssignSerializer(serializers.Serializer):
    office = serializers.PrimaryKeyRelatedField(queryset=Office.objects.all())

    def validate_office(self, office):
        vehicle = self.context["vehicle"]
        if vehicle.office_id == office.pk:
            raise serializers.ValidationError(f"Vehicle is already assigned to {office.name}.")
        return office


class NeedsMaintenanceSerializer(serializers.ModelSerializer):
    office_detail = OfficeBriefSerializer(source="office", read_only=True)
    last_maintenance = serializers.DateField(allow_null=True)
    days_since_maintenance = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vin",
            "license_plate",
            "make",
            "model",
            "year",
            "office",
            "office_detail",
            "last_maintenance",
            "days_since_maintenance",
        ]

    def get_days_since_maintenance(self, obj):
        if obj.last_maintenance is None:
            return None
        return (self.context["today"] - obj.last_maintenance).days


class DuplicateCheckQuerySerializer(serializers.Serializer):
    vin = serializers.CharField(allow_blank=True, trim_whitespace=True)
    license_plate = serializers.CharField(allow_blank=True, trim_whitespace=True)
    exclude = serializers.IntegerField(required=False)
    active = serializers.BooleanField(default=True)
