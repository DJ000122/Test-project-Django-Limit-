from django.contrib import admin

from fleet.models import MaintenanceRecord, Mechanic, Office, Vehicle


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ["name", "city"]
    search_fields = ["name", "city"]


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["vin", "license_plate", "make", "model", "year", "office", "active"]
    list_filter = ["active", "office", "make"]
    search_fields = ["vin", "license_plate", "make", "model"]
    list_select_related = ["office"]


@admin.register(Mechanic)
class MechanicAdmin(admin.ModelAdmin):
    list_display = ["name", "certification_number", "active"]
    list_filter = ["active"]
    search_fields = ["name", "certification_number"]


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = ["date", "vehicle", "mechanic", "maintenance_type", "cost"]
    list_filter = ["maintenance_type"]
    list_select_related = ["vehicle", "mechanic"]
    raw_id_fields = ["vehicle", "mechanic"]
    date_hierarchy = "date"
