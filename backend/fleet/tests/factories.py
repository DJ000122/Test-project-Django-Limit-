import itertools
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from fleet.models import MaintenanceRecord, MaintenanceType, Mechanic, Office, Vehicle

_office_seq = itertools.count(1)
_mech_seq = itertools.count(1)
_plate_seq = itertools.count(1)
_vin_seq = itertools.count(100)


def today():
    return timezone.localdate()


def days_ago(n: int):
    return today() - timedelta(days=n)


def make_vin(seed=None) -> str:
    if seed is not None:
        return f"1HGBH41JXMN{seed:06d}"
    return f"1HGBH41JXMN{next(_vin_seq):06d}"


def make_office(**kwargs):
    i = next(_office_seq)
    defaults = {"name": f"Office {i}", "city": f"City {i}"}
    defaults.update(kwargs)
    return Office.objects.create(**defaults)


def make_mechanic(**kwargs):
    i = next(_mech_seq)
    defaults = {"name": f"Mechanic {i}", "certification_number": f"ASE-{100000 + i}", "active": True}
    defaults.update(kwargs)
    return Mechanic.objects.create(**defaults)


def make_vehicle(office=None, **kwargs):
    if office is None:
        office = make_office()
    defaults = {
        "vin": make_vin(),
        "license_plate": f"PLT{next(_plate_seq)}",
        "make": "Ford",
        "model": "Transit",
        "year": 2022,
        "office": office,
        "active": True,
    }
    defaults.update(kwargs)
    return Vehicle.objects.create(**defaults)


def make_record(vehicle, mechanic=None, **kwargs):
    if mechanic is None:
        mechanic = make_mechanic()
    defaults = {
        "vehicle": vehicle,
        "mechanic": mechanic,
        "date": today(),
        "maintenance_type": MaintenanceType.OIL_CHANGE,
        "cost": Decimal("50.00"),
        "notes": "",
    }
    defaults.update(kwargs)
    return MaintenanceRecord.objects.create(**defaults)
