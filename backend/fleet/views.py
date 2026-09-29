from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from fleet import queries
from fleet.filters import MaintenanceRecordFilter, MechanicFilter, VehicleFilter
from fleet.models import MaintenanceRecord, MaintenanceType, Mechanic, Office, Vehicle
from fleet.serializers import (
    DuplicateCheckQuerySerializer,
    MaintenanceHistoryItemSerializer,
    MaintenanceRecordSerializer,
    MechanicSerializer,
    MechanicWorkloadSerializer,
    NeedsMaintenanceSerializer,
    OfficeSerializer,
    OfficeSummarySerializer,
    VehicleAssignSerializer,
    VehicleDetailSerializer,
    VehicleSerializer,
    vehicle_conflicts,
)


class OfficeViewSet(viewsets.ModelViewSet):
    queryset = Office.objects.all()
    serializer_class = OfficeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "city"]
    ordering_fields = ["name", "city"]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        offices = queries.office_summary_queryset(timezone.localdate())
        return Response(OfficeSummarySerializer(offices, many=True).data)


class MechanicViewSet(viewsets.ModelViewSet):
    queryset = Mechanic.objects.all()
    serializer_class = MechanicSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = MechanicFilter
    search_fields = ["name", "certification_number"]
    ordering_fields = ["name", "certification_number"]

    @action(detail=False, methods=["get"])
    def workload(self, request):
        mechanics = queries.mechanic_workload_queryset(timezone.localdate())
        page = self.paginate_queryset(mechanics)
        data = MechanicWorkloadSerializer(page, many=True).data
        return self.get_paginated_response(data)


class VehicleViewSet(viewsets.ModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = VehicleFilter
    search_fields = ["vin", "license_plate", "make", "model"]
    ordering_fields = ["make", "model", "year", "license_plate", "office__name", "last_maintenance"]
    ordering = ["make", "model", "vin"]

    def get_queryset(self):
        if self.action == "retrieve":
            return queries.vehicle_detail_queryset()
        return queries.vehicle_list_queryset()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VehicleDetailSerializer
        return VehicleSerializer

    def _reload(self, pk):
        return queries.vehicle_list_queryset().get(pk=pk)

    def perform_create(self, serializer):
        serializer.instance = self._reload(serializer.save().pk)

    def perform_update(self, serializer):
        serializer.instance = self._reload(serializer.save().pk)

    @action(detail=True, methods=["get"], url_path="maintenance")
    def maintenance_history(self, request, pk=None):
        vehicle = get_object_or_404(Vehicle.objects.only("pk"), pk=pk)
        records = (
            MaintenanceRecord.objects.filter(vehicle=vehicle)
            .select_related("mechanic")
            .order_by("-date", "-id")
        )
        page = self.paginate_queryset(records)
        data = MaintenanceHistoryItemSerializer(page, many=True).data
        return self.get_paginated_response(data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        with transaction.atomic():
            vehicle = get_object_or_404(Vehicle.objects.select_for_update(), pk=pk)
            serializer = VehicleAssignSerializer(data=request.data, context={"vehicle": vehicle})
            serializer.is_valid(raise_exception=True)
            vehicle.office = serializer.validated_data["office"]
            vehicle.save(update_fields=["office", "updated_at"])
        return Response(VehicleSerializer(self._reload(vehicle.pk)).data)

    @action(detail=False, methods=["get"], url_path="needs-maintenance")
    def needs_maintenance(self, request):
        today = timezone.localdate()
        vehicles = queries.vehicles_needing_maintenance_queryset(today)
        page = self.paginate_queryset(vehicles)
        data = NeedsMaintenanceSerializer(page, many=True, context={"today": today}).data
        return self.get_paginated_response(data)

    @action(detail=False, methods=["get"], url_path="check-duplicate")
    def check_duplicate(self, request):
        params = DuplicateCheckQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        data = params.validated_data
        conflicts = vehicle_conflicts(
            data["vin"],
            data["license_plate"],
            active=data["active"],
            exclude_pk=data.get("exclude"),
        )
        return Response({"conflicts": conflicts})

    @action(detail=False, methods=["get"])
    def facets(self, request):
        pairs = Vehicle.objects.order_by("make", "model").values_list("make", "model").distinct()
        makes = {}
        for make, model in pairs:
            makes.setdefault(make, []).append(model)
        return Response({"makes": [{"make": m, "models": ms} for m, ms in makes.items()]})


class MaintenanceRecordViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("vehicle", "mechanic").order_by(
        "-date", "-id"
    )
    serializer_class = MaintenanceRecordSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = MaintenanceRecordFilter
    ordering_fields = ["date", "cost"]


@api_view(["GET"])
def maintenance_types(request):
    return Response([{"value": value, "label": label} for value, label in MaintenanceType.choices])
