from datetime import date
from decimal import Decimal
from unittest import mock

from django.db import connection
from django.test.utils import CaptureQueriesContext

from fleet.queries import one_year_before
from fleet.tests.base import AuthenticatedAPITestCase
from fleet.tests.factories import (
    days_ago,
    make_mechanic,
    make_office,
    make_record,
    make_vehicle,
    today,
)


class OfficeSummaryTests(AuthenticatedAPITestCase):
    def test_counts_costs_and_last_maintenance_per_office(self):
        ny = make_office(name="New York", city="New York")
        empty = make_office(name="Boise", city="Boise")
        v1 = make_vehicle(office=ny)
        v2 = make_vehicle(office=ny)
        retired = make_vehicle(office=ny, active=False)
        make_record(v1, cost="100.25", date=days_ago(5))
        make_record(v1, cost="50.00", date=days_ago(200))
        make_record(v2, cost="10.00", date=days_ago(400))  # older than 12 months
        make_record(retired, cost="1.00", date=days_ago(3))  # counts toward cost

        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get("/api/offices/summary/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(ctx.captured_queries), 1)

        by_name = {row["name"]: row for row in res.data}
        self.assertEqual(by_name["New York"]["active_vehicle_count"], 2)
        self.assertEqual(Decimal(str(by_name["New York"]["maintenance_cost_last_year"])), Decimal("151.25"))
        self.assertEqual(by_name["New York"]["last_maintenance"], days_ago(3).isoformat())
        self.assertEqual(by_name["Boise"]["active_vehicle_count"], 0)
        self.assertEqual(by_name["Boise"]["maintenance_cost_last_year"], 0)
        self.assertIsNone(by_name["Boise"]["last_maintenance"])
        self.assertEqual(
            set(by_name["Boise"]),
            {"id", "name", "city", "active_vehicle_count", "maintenance_cost_last_year", "last_maintenance"},
        )

    def test_one_year_before_handles_leap_day(self):
        self.assertEqual(one_year_before(date(2028, 2, 29)), date(2027, 2, 28))


class VehicleSearchTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.ny, self.chi = make_office(), make_office()
        self.alice = make_mechanic(certification_number="ASE-ALICE")
        self.bob = make_mechanic(certification_number="ASE-BOB")
        self.ford = make_vehicle(office=self.ny, make="Ford", model="Transit")
        self.toyota = make_vehicle(office=self.ny, make="Toyota", model="Camry")
        self.old_ford = make_vehicle(office=self.chi, make="Ford", model="F-150", active=False)
        make_record(self.ford, self.alice, date=date(2026, 3, 1))
        make_record(self.ford, self.alice, date=date(2026, 3, 5))  # two matches, returned once
        make_record(self.toyota, self.bob, date=date(2026, 3, 2))
        make_record(self.old_ford, self.bob, date=date(2025, 1, 1))

    def ids(self, query):
        res = self.client.get(f"/api/vehicles/?page_size=50&{query}")
        self.assertEqual(res.status_code, 200, res.data)
        return {row["id"] for row in res.data["results"]}

    def test_no_filters_returns_everything(self):
        self.assertEqual(self.ids(""), {self.ford.pk, self.toyota.pk, self.old_ford.pk})

    def test_simple_filters(self):
        self.assertEqual(self.ids(f"office={self.ny.pk}"), {self.ford.pk, self.toyota.pk})
        self.assertEqual(self.ids("active=false"), {self.old_ford.pk})
        self.assertEqual(self.ids("make=ford"), {self.ford.pk, self.old_ford.pk})
        self.assertEqual(self.ids("model=CAMRY"), {self.toyota.pk})

    def test_maintenance_date_range(self):
        self.assertEqual(
            self.ids("maintenance_from=2026-03-01&maintenance_to=2026-03-02"),
            {self.ford.pk, self.toyota.pk},
        )
        self.assertEqual(self.ids("maintenance_to=2025-12-31"), {self.old_ford.pk})
        self.assertEqual(self.ids("maintenance_from=2026-03-03"), {self.ford.pk})

    def test_mechanic_certification(self):
        self.assertEqual(self.ids("mechanic_certification=ase-bob"), {self.toyota.pk, self.old_ford.pk})

    def test_date_range_and_mechanic_apply_to_the_same_record(self):
        # Bob worked on old_ford, but not in March 2026.
        self.assertEqual(
            self.ids("mechanic_certification=ASE-BOB&maintenance_from=2026-03-01&maintenance_to=2026-03-31"),
            {self.toyota.pk},
        )

    def test_combined_filters(self):
        self.assertEqual(
            self.ids(f"office={self.ny.pk}&make=ford&active=true&mechanic_certification=ASE-ALICE"),
            {self.ford.pk},
        )
        self.assertEqual(self.ids(f"office={self.chi.pk}&active=true"), set())

    def test_invalid_params_are_400(self):
        res = self.client.get("/api/vehicles/?maintenance_from=not-a-date")
        self.assertEqual(res.status_code, 400)
        self.assertIn("maintenance_from", res.data)
        res = self.client.get("/api/vehicles/?maintenance_from=2026-05-01&maintenance_to=2026-01-01")
        self.assertEqual(res.status_code, 400)
        self.assertIn("maintenance_to", res.data)

    def test_list_includes_last_maintenance_without_n_plus_one(self):
        for _ in range(10):
            make_record(make_vehicle(office=self.ny))
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get("/api/vehicles/?page_size=50")
        self.assertEqual(res.data["count"], 13)
        self.assertEqual(len(ctx.captured_queries), 2)  # count + page
        row = next(r for r in res.data["results"] if r["id"] == self.ford.pk)
        self.assertEqual(row["last_maintenance"], "2026-03-05")


class VehicleDetailTests(AuthenticatedAPITestCase):
    def test_detail_includes_office_history_and_mechanics_in_constant_queries(self):
        office = make_office(name="Denver", city="Denver")
        vehicle = make_vehicle(office=office)
        mechanics = [make_mechanic() for _ in range(5)]
        for i in range(300):
            make_record(vehicle, mechanics[i % 5], date=days_ago(i), cost="10.00")

        with self.assertNumQueries(2):
            res = self.client.get(f"/api/vehicles/{vehicle.pk}/")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["office_detail"], {"id": office.pk, "name": "Denver", "city": "Denver"})
        self.assertEqual(res.data["maintenance_count"], 300)
        self.assertEqual(res.data["total_maintenance_cost"], 3000)
        history = res.data["maintenance_records"]
        self.assertEqual(len(history), 300)
        self.assertEqual(history[0]["date"], today().isoformat())
        self.assertEqual(set(history[0]["mechanic"]), {"id", "name", "certification_number", "active"})


class MaintenanceHistoryTests(AuthenticatedAPITestCase):
    def test_newest_first_and_paginated(self):
        vehicle = make_vehicle()
        oldest = make_record(vehicle, date=days_ago(30))
        newest = make_record(vehicle, date=days_ago(1))
        middle = make_record(vehicle, date=days_ago(10))
        make_record(make_vehicle())  # someone else's

        res = self.client.get(f"/api/vehicles/{vehicle.pk}/maintenance/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r["id"] for r in res.data["results"]], [newest.pk, middle.pk, oldest.pk])
        self.assertIn("name", res.data["results"][0]["mechanic"])

        res = self.client.get(f"/api/vehicles/{vehicle.pk}/maintenance/?page_size=2&page=2")
        self.assertEqual([r["id"] for r in res.data["results"]], [oldest.pk])

    def test_same_day_records_are_ordered_by_newest_entry(self):
        vehicle = make_vehicle()
        first = make_record(vehicle, date=days_ago(1))
        second = make_record(vehicle, date=days_ago(1))
        res = self.client.get(f"/api/vehicles/{vehicle.pk}/maintenance/")
        self.assertEqual([r["id"] for r in res.data["results"]], [second.pk, first.pk])

    def test_unknown_vehicle_is_404(self):
        self.assertEqual(self.client.get("/api/vehicles/999/maintenance/").status_code, 404)


class AssignVehicleTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.origin, self.target = make_office(), make_office()
        self.vehicle = make_vehicle(office=self.origin, model="Transit")

    def test_moves_vehicle_and_writes_only_the_office_column(self):
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.post(
                f"/api/vehicles/{self.vehicle.pk}/assign/",
                {"office": self.target.pk, "model": "Hacked"},
                format="json",
            )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["office"], self.target.pk)
        self.assertEqual(res.data["model"], "Transit")  # extra fields ignored

        update_sql = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("UPDATE")]
        self.assertEqual(len(update_sql), 1)
        set_clause = update_sql[0].split(" SET ")[1].split(" WHERE ")[0]
        self.assertIn('"office_id"', set_clause)
        self.assertNotIn('"model"', set_clause)
        self.assertNotIn('"license_plate"', set_clause)

        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.office_id, self.target.pk)

    def test_validation(self):
        url = f"/api/vehicles/{self.vehicle.pk}/assign/"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        res = self.client.post(url, {"office": 9999}, format="json")
        self.assertEqual(res.status_code, 400)
        res = self.client.post(url, {"office": self.origin.pk}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("already assigned", str(res.data["office"][0]))
        self.assertEqual(
            self.client.post("/api/vehicles/999/assign/", {"office": self.target.pk}, format="json").status_code,
            404,
        )

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get(f"/api/vehicles/{self.vehicle.pk}/assign/").status_code, 405)


class MechanicWorkloadTests(AuthenticatedAPITestCase):
    def test_counts_current_year_only_and_orders_busiest_first(self):
        vehicle = make_vehicle()
        busy = make_mechanic(name="Busy")
        light = make_mechanic(name="Light")
        idle = make_mechanic(name="Idle")
        retired_idle = make_mechanic(name="Retired idle", active=False)
        retired_busy = make_mechanic(name="Retired busy", active=False)
        jan1 = date(today().year, 1, 1)

        for cost in ("100", "200", "300"):
            make_record(vehicle, busy, date=jan1, cost=cost)
        make_record(vehicle, busy, date=date(today().year - 1, 12, 31), cost="9999")  # last year
        make_record(vehicle, light, date=today(), cost="1000")
        make_record(vehicle, retired_busy, date=jan1, cost="5")
        make_record(vehicle, retired_idle, date=date(today().year - 1, 6, 1))

        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get("/api/mechanics/workload/")
        self.assertLessEqual(len(ctx.captured_queries), 2)

        rows = res.data["results"]
        self.assertEqual([r["name"] for r in rows], ["Busy", "Light", "Retired busy", "Idle"])
        self.assertEqual(rows[0]["records_this_year"], 3)
        self.assertEqual(rows[0]["cost_this_year"], 600)
        self.assertEqual(rows[-1]["records_this_year"], 0)
        self.assertEqual(rows[-1]["cost_this_year"], 0)


class NeedsMaintenanceTests(AuthenticatedAPITestCase):
    def test_active_never_or_stale_ordered_oldest_first(self):
        never = make_vehicle()
        stale_old = make_vehicle()
        stale = make_vehicle()
        fresh = make_vehicle()
        boundary = make_vehicle()
        inactive = make_vehicle(active=False)
        make_record(stale_old, date=days_ago(900))
        make_record(stale_old, date=days_ago(800))
        make_record(stale, date=days_ago(400))
        make_record(fresh, date=days_ago(900))
        make_record(fresh, date=days_ago(10))
        make_record(boundary, date=days_ago(365))  # exactly 365 days is not "more than"

        res = self.client.get("/api/vehicles/needs-maintenance/")
        self.assertEqual(res.status_code, 200)
        ids = [r["id"] for r in res.data["results"]]
        self.assertEqual(ids, [never.pk, stale_old.pk, stale.pk])
        self.assertNotIn(inactive.pk, ids)
        self.assertIsNone(res.data["results"][0]["last_maintenance"])
        self.assertEqual(res.data["results"][1]["days_since_maintenance"], 800)


class DuplicateCheckTests(AuthenticatedAPITestCase):
    def setUp(self):
        self.vehicle = make_vehicle(license_plate="ABC123")

    def check(self, query):
        res = self.client.get(f"/api/vehicles/check-duplicate/?{query}")
        self.assertEqual(res.status_code, 200, res.data)
        return res.data["conflicts"]

    def test_reports_each_conflicting_field(self):
        vin = self.vehicle.vin
        self.assertEqual(self.check(f"vin={vin}&license_plate=abc-123"), ["vin", "license_plate"])
        self.assertEqual(self.check(f"vin={vin.lower()}&license_plate=NEW1"), ["vin"])
        self.assertEqual(self.check("vin=1HGCM82633A999999&license_plate=abc123"), ["license_plate"])
        self.assertEqual(self.check("vin=1HGCM82633A999999&license_plate=NEW1"), [])

    def test_inactive_vehicles_do_not_hold_plates(self):
        self.vehicle.active = False
        self.vehicle.save()
        self.assertEqual(self.check("vin=1HGCM82633A999999&license_plate=ABC123"), [])

    def test_exclude_self_when_editing(self):
        query = f"vin={self.vehicle.vin}&license_plate=ABC123&exclude={self.vehicle.pk}"
        self.assertEqual(self.check(query), [])

    def test_missing_params_are_400(self):
        res = self.client.get("/api/vehicles/check-duplicate/?vin=X")
        self.assertEqual(res.status_code, 400)
        self.assertIn("license_plate", res.data)


class SeedCommandTests(AuthenticatedAPITestCase):
    def test_seed_creates_useful_dataset(self):
        from django.core.management import call_command

        from fleet.models import MaintenanceRecord, Vehicle

        with mock.patch("sys.stdout"):
            call_command("seed_fleet", vehicles=30, mechanics=5, records=200, offices=3)
        self.assertEqual(Vehicle.objects.count(), 30)
        self.assertGreater(MaintenanceRecord.objects.count(), 400)
        res = self.client.get("/api/vehicles/needs-maintenance/")
        self.assertGreater(res.data["count"], 0)
