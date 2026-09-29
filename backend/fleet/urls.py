from django.urls import path
from rest_framework.routers import DefaultRouter

from fleet import auth, views

router = DefaultRouter()
router.register("offices", views.OfficeViewSet, basename="office")
router.register("vehicles", views.VehicleViewSet, basename="vehicle")
router.register("mechanics", views.MechanicViewSet, basename="mechanic")
router.register("maintenance-records", views.MaintenanceRecordViewSet, basename="maintenance-record")

urlpatterns = [
    path("auth/token/", auth.LoginView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", auth.RefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", auth.LogoutView.as_view(), name="logout"),
    path("auth/me/", auth.MeView.as_view(), name="me"),
    path("maintenance-types/", views.maintenance_types, name="maintenance-types"),
    *router.urls,
]
