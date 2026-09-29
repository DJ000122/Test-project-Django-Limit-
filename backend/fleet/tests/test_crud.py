from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from fleet.models import Vehicle
from fleet.tests.base import AuthenticatedAPITestCase
from fleet.tests.factories import (
    make_mechanic,
    make_office,
    make_record,
    make_vehicle,
    make_vin,
)


class VehicleCrudTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.office = make_office(name="NYC", city="New York")

    def payload(self, **overrides):
        return {
            "vin": make_vin(),
            "license_plate": "abc-123",
            "make": "Toyota",
            "model": "Camry",
            "year": 2023,
            "office": self.office.pk,
            **overrides,
        }

    def test_create_normalizes_vin_and_plate(self):
        res = self.client.post("/api/vehicles/", self.payload(vin=make_vin(1).lower()), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["vin"], make_vin(1))
        self.assertEqual(res.data["license_plate"], "ABC123")
        self.assertEqual(res.data["office_detail"]["name"], "NYC")
        self.assertTrue(res.data["active"])

    def test_invalid_payload_returns_field_messages(self):
        res = self.client.post(
            "/api/vehicles/",
            self.payload(vin="SHORT", year=1850, office=9999),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("17", str(res.data["vin"][0]))
        self.assertIn("Year must be between", str(res.data["year"][0]))
        self.assertIn("office", res.data)

    def test_vin_letters_i_o_q_rejected(self):
        res = self.client.post("/api/vehicles/", self.payload(vin="1HGCM82633A00000O"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("I, O or Q", str(res.data["vin"][0]))

    def test_vin_must_be_unique_case_insensitively(self):
        existing = make_vehicle(office=self.office)
        res = self.client.post("/api/vehicles/", self.payload(vin=existing.vin.lower()), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("already exists", str(res.data["vin"][0]))

    def test_plate_cannot_be_shared_by_two_active_vehicles(self):
        make_vehicle(office=self.office, license_plate="ABC123")
        res = self.client.post("/api/vehicles/", self.payload(license_plate="abc 123"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("another active vehicle", str(res.data["license_plate"][0]))

    def test_plate_can_be_reused_when_other_vehicle_is_inactive(self):
        make_vehicle(office=self.office, license_plate="ABC123", active=False)
        res = self.client.post("/api/vehicles/", self.payload(license_plate="ABC123"), format="json")
        self.assertEqual(res.status_code, 201, res.data)

    def test_inactive_vehicle_may_share_plate_with_active_one(self):
        make_vehicle(office=self.office, license_plate="ABC123")
        res = self.client.post(
            "/api/vehicles/", self.payload(license_plate="ABC123", active=False), format="json"
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_reactivating_vehicle_with_taken_plate_is_rejected(self):
        make_vehicle(office=self.office, license_plate="ABC123")
        retired = make_vehicle(office=self.office, license_plate="ABC123", active=False)
        res = self.client.patch(f"/api/vehicles/{retired.pk}/", {"active": True}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("license_plate", res.data)

    def test_update_does_not_conflict_with_itself(self):
        vehicle = make_vehicle(office=self.office, license_plate="ABC123")
        res = self.client.patch(
            f"/api/vehicles/{vehicle.pk}/", {"license_plate": "ABC123", "model": "Sienna"}, format="json"
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["model"], "Sienna")

    def test_database_enforces_active_plate_uniqueness(self):
        make_vehicle(office=self.office, license_plate="ZZZ999")
        with self.assertRaises(IntegrityError), transaction.atomic():
            make_vehicle(office=self.office, license_plate="ZZZ999")

    def test_delete_vehicle_without_history(self):
        vehicle = make_vehicle(office=self.office)
        res = self.client.delete(f"/api/vehicles/{vehicle.pk}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Vehicle.objects.filter(pk=vehicle.pk).exists())

    def test_delete_vehicle_with_history_is_conflict(self):
        vehicle = make_vehicle(office=self.office)
        make_record(vehicle)
        res = self.client.delete(f"/api/vehicles/{vehicle.pk}/")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("maintenance records", res.data["detail"])

    def test_unknown_vehicle_is_404(self):
        self.assertEqual(self.client.get("/api/vehicles/999/").status_code, 404)


class OfficeCrudTests(AuthenticatedAPITestCase):
    def test_crud_roundtrip(self):
        res = self.client.post("/api/offices/", {"name": "Austin", "city": "Austin"}, format="json")
        self.assertEqual(res.status_code, 201)
        pk = res.data["id"]
        res = self.client.put(f"/api/offices/{pk}/", {"name": "Austin East", "city": "Austin"}, format="json")
        self.assertEqual(res.data["name"], "Austin East")
        self.assertEqual(self.client.delete(f"/api/offices/{pk}/").status_code, 204)

    def test_duplicate_office_name_in_same_city_rejected(self):
        make_office(name="Austin", city="Austin")
        res = self.client.post("/api/offices/", {"name": "austin", "city": "AUSTIN"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("already exists", str(res.data["name"][0]))

    def test_office_with_vehicles_cannot_be_deleted(self):
        office = make_office()
        make_vehicle(office=office)
        res = self.client.delete(f"/api/offices/{office.pk}/")
        self.assertEqual(res.status_code, 409)
        self.assertIn("vehicles", res.data["detail"])

    def test_required_fields(self):
        res = self.client.post("/api/offices/", {}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.data), {"name", "city"})


class MechanicCrudTests(AuthenticatedAPITestCase):
    def test_certification_number_unique(self):
        make_mechanic(certification_number="ASE-1")
        res = self.client.post(
            "/api/mechanics/", {"name": "Bo", "certification_number": "ase-1"}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("already exists", str(res.data["certification_number"][0]))

    def test_filter_by_active(self):
        make_mechanic(active=True)
        make_mechanic(active=False)
        res = self.client.get("/api/mechanics/?active=false")
        self.assertEqual(res.data["count"], 1)


class MaintenanceRecordCrudTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.vehicle = make_vehicle()
        self.mechanic = make_mechanic()

    def payload(self, **overrides):
        return {
            "vehicle": self.vehicle.pk,
            "mechanic": self.mechanic.pk,
            "date": timezone.localdate().isoformat(),
            "maintenance_type": "brakes",
            "cost": "250.50",
            "notes": "Front pads",
            **overrides,
        }

    def test_create_and_read(self):
        res = self.client.post("/api/maintenance-records/", self.payload(), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["cost"], 250.5)
        self.assertEqual(res.data["maintenance_type_display"], "Brake service")
        self.assertEqual(res.data["mechanic_name"], self.mechanic.name)

    def test_validation_messages(self):
        future = (timezone.localdate() + timedelta(days=3)).isoformat()
        res = self.client.post(
            "/api/maintenance-records/",
            self.payload(date=future, cost="-1", maintenance_type="car_wash"),
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("future", str(res.data["date"][0]))
        self.assertIn("cost", res.data)
        self.assertIn("maintenance_type", res.data)

    def test_inactive_mechanic_cannot_receive_new_work(self):
        retired = make_mechanic(active=False)
        res = self.client.post("/api/maintenance-records/", self.payload(mechanic=retired.pk), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("inactive", str(res.data["mechanic"][0]))

    def test_existing_record_of_retired_mechanic_can_still_be_edited(self):
        retired = make_mechanic()
        record = make_record(self.vehicle, retired)
        retired.active = False
        retired.save()
        res = self.client.patch(
            f"/api/maintenance-records/{record.pk}/", {"notes": "Corrected"}, format="json"
        )
        self.assertEqual(res.status_code, 200, res.data)

    def test_mechanic_with_history_cannot_be_deleted(self):
        make_record(self.vehicle, self.mechanic)
        res = self.client.delete(f"/api/mechanics/{self.mechanic.pk}/")
        self.assertEqual(res.status_code, 409)

    def test_filter_by_vehicle_and_date_range(self):
        make_record(self.vehicle, self.mechanic, date=timezone.localdate() - timedelta(days=10))
        make_record(self.vehicle, self.mechanic, date=timezone.localdate() - timedelta(days=100))
        make_record(make_vehicle(), self.mechanic)
        since = (timezone.localdate() - timedelta(days=30)).isoformat()
        res = self.client.get(f"/api/maintenance-records/?vehicle={self.vehicle.pk}&date_from={since}")
        self.assertEqual(res.data["count"], 1)
