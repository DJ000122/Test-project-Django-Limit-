import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from faker import Faker

from fleet.models import MaintenanceRecord, MaintenanceType, Mechanic, Office, Vehicle
from fleet.serializers import normalize_plate

OFFICES = [
    ("New York HQ", "New York"),
    ("Chicago Loop", "Chicago"),
    ("Austin", "Austin"),
    ("Denver", "Denver"),
    ("Seattle", "Seattle"),
    ("Atlanta", "Atlanta"),
    ("Miami", "Miami"),
    ("Phoenix", "Phoenix"),
    ("Boston", "Boston"),
    ("San Francisco", "San Francisco"),
]

MAKES = {
    "Ford": ["F-150", "Transit", "Explorer", "Escape", "Ranger"],
    "Toyota": ["Camry", "Corolla", "RAV4", "Tacoma", "Prius"],
    "Chevrolet": ["Silverado", "Express", "Malibu", "Equinox"],
    "Honda": ["Civic", "Accord", "CR-V", "Odyssey"],
    "Tesla": ["Model 3", "Model Y"],
    "Ram": ["1500", "ProMaster"],
    "Nissan": ["Altima", "Rogue", "NV200"],
}

# (type, weight, min cost, max cost)
MAINTENANCE_PROFILE = [
    (MaintenanceType.OIL_CHANGE, 30, 45, 120),
    (MaintenanceType.TIRE_ROTATION, 20, 30, 90),
    (MaintenanceType.INSPECTION, 15, 60, 200),
    (MaintenanceType.BRAKES, 12, 180, 900),
    (MaintenanceType.BATTERY, 6, 120, 350),
    (MaintenanceType.REPAIR, 10, 200, 4500),
    (MaintenanceType.TRANSMISSION, 3, 900, 5500),
    (MaintenanceType.OTHER, 4, 40, 600),
]

NOTES = {
    MaintenanceType.OIL_CHANGE: ["Synthetic 5W-30, filter replaced.", "Conventional oil, topped off fluids."],
    MaintenanceType.TIRE_ROTATION: ["Rotated and balanced.", "Rotated; front tires at 4/32, replace soon."],
    MaintenanceType.INSPECTION: ["Annual state inspection passed.", "Passed; wiper blades replaced."],
    MaintenanceType.BRAKES: ["Front pads and rotors replaced.", "Rear pads replaced, fluid flushed."],
    MaintenanceType.BATTERY: ["Battery failed load test; replaced.", "Terminals cleaned, battery OK."],
    MaintenanceType.REPAIR: ["Replaced alternator.", "Fixed coolant leak at water pump.", "Replaced side mirror."],
    MaintenanceType.TRANSMISSION: ["Transmission fluid service.", "Replaced clutch pack."],
    MaintenanceType.OTHER: ["Detailing.", "Recall work performed.", ""],
}

VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "fleet-demo-2026"


class Command(BaseCommand):
    help = "Seed the database with dummy offices, vehicles, mechanics and maintenance records."

    def add_arguments(self, parser):
        parser.add_argument("--offices", type=int, default=6)
        parser.add_argument("--vehicles", type=int, default=150)
        parser.add_argument("--mechanics", type=int, default=20)
        parser.add_argument("--records", type=int, default=2500, help="Approximate record count.")
        parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible data.")
        parser.add_argument("--flush", action="store_true", help="Delete existing fleet data first.")
        parser.add_argument(
            "--no-demo-user", action="store_true", help=f'Don\'t create the "{DEMO_USERNAME}" login.'
        )

    def handle(self, *args, **opts):
        if not 1 <= opts["offices"] <= len(OFFICES):
            raise CommandError(f"--offices must be between 1 and {len(OFFICES)}.")
        if opts["vehicles"] < 1 or opts["mechanics"] < 1:
            raise CommandError("--vehicles and --mechanics must be at least 1.")

        rng = random.Random(opts["seed"])
        fake = Faker("en_US")
        fake.seed_instance(opts["seed"])
        today = timezone.localdate()

        with transaction.atomic():
            if opts["flush"]:
                MaintenanceRecord.objects.all().delete()
                Vehicle.objects.all().delete()
                Mechanic.objects.all().delete()
                Office.objects.all().delete()
            elif Vehicle.objects.exists():
                raise CommandError("Fleet data already exists. Re-run with --flush to replace it.")

            offices = self._offices(opts["offices"])
            mechanics = self._mechanics(fake, rng, opts["mechanics"])
            vehicles = self._vehicles(fake, rng, offices, opts["vehicles"], today)
            records = self._records(fake, rng, vehicles, mechanics, opts["records"], today)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(offices)} offices, {len(vehicles)} vehicles, "
                f"{len(mechanics)} mechanics and {records} maintenance records."
            )
        )
        if not opts["no_demo_user"]:
            self._demo_user()

    def _demo_user(self):
        User = get_user_model()
        if User.objects.filter(username=DEMO_USERNAME).exists():
            self.stdout.write(f'Login user "{DEMO_USERNAME}" already exists (password unchanged).')
            return
        User.objects.create_user(DEMO_USERNAME, password=DEMO_PASSWORD, first_name="Demo", last_name="User")
        self.stdout.write(
            self.style.SUCCESS(f"Created login: username {DEMO_USERNAME} / password {DEMO_PASSWORD}")
        )

    def _offices(self, count):
        return Office.objects.bulk_create(Office(name=n, city=c) for n, c in OFFICES[:count])

    def _mechanics(self, fake, rng, count):
        certs = set()
        mechanics = []
        for i in range(count):
            cert = f"ASE-{rng.randint(100000, 999999)}"
            while cert in certs:
                cert = f"ASE-{rng.randint(100000, 999999)}"
            certs.add(cert)
            mechanics.append(Mechanic(name=fake.name(), certification_number=cert, active=i % 8 != 7))
        return Mechanic.objects.bulk_create(mechanics)

    def _vehicles(self, fake, rng, offices, count, today):
        vins, plates = set(), set()

        def new_vin():
            while True:
                vin = "".join(rng.choice(VIN_ALPHABET) for _ in range(17))
                if vin not in vins:
                    vins.add(vin)
                    return vin

        def new_plate():
            while True:
                plate = normalize_plate(fake.license_plate())
                if plate not in plates:
                    plates.add(plate)
                    return plate

        vehicles = []
        for i in range(count):
            make = rng.choice(list(MAKES))
            vehicles.append(
                Vehicle(
                    vin=new_vin(),
                    license_plate=new_plate(),
                    make=make,
                    model=rng.choice(MAKES[make]),
                    year=rng.randint(today.year - 12, today.year),
                    office=rng.choice(offices),
                    active=rng.random() > 0.1,
                )
            )
        if count >= 2:
            retired, active = vehicles[-1], vehicles[0]
            retired.active, active.active = False, True
            retired.license_plate = active.license_plate
        return Vehicle.objects.bulk_create(vehicles)

    def _records(self, fake, rng, vehicles, mechanics, target, today):
        types = [p[0] for p in MAINTENANCE_PROFILE]
        weights = [p[1] for p in MAINTENANCE_PROFILE]
        cost_ranges = {p[0]: (p[2], p[3]) for p in MAINTENANCE_PROFILE}
        horizon_days = 4 * 365

        heavy, *rest = vehicles
        rng.shuffle(rest)
        n_never = max(1, len(rest) * 8 // 100) if rest else 0
        n_stale = max(1, len(rest) // 10) if rest else 0
        stale = rest[n_never : n_never + n_stale]
        regular = rest[n_never + n_stale :]

        def make_record(vehicle, day):
            mtype = rng.choices(types, weights)[0]
            lo, hi = cost_ranges[mtype]
            return MaintenanceRecord(
                vehicle=vehicle,
                mechanic=rng.choice(mechanics),
                date=day,
                maintenance_type=mtype,
                cost=Decimal(rng.randint(lo * 100, hi * 100)) / 100,
                notes=rng.choice(NOTES[mtype]),
            )

        records = [make_record(heavy, today - timedelta(days=rng.randint(0, horizon_days))) for _ in range(400)]
        for vehicle in stale:
            for _ in range(rng.randint(1, 4)):
                records.append(make_record(vehicle, today - timedelta(days=rng.randint(400, horizon_days))))
        remaining = max(0, target - len(records))
        for i in range(remaining):
            if not regular:
                break
            records.append(make_record(regular[i % len(regular)], today - timedelta(days=rng.randint(0, horizon_days))))
        for vehicle in regular:
            records.append(make_record(vehicle, today - timedelta(days=rng.randint(0, 300))))

        MaintenanceRecord.objects.bulk_create(records, batch_size=1000)
        return len(records)

