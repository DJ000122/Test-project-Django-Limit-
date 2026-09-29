from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from fleet.tests.factories import make_office


class JwtAuthTests(APITestCase):
    def setUp(self):
        cache.clear()  # reset login throttling between tests
        self.user = get_user_model().objects.create_user("dispatcher", password="s3cret-pass")

    def login(self, password="s3cret-pass"):
        return self.client.post(
            "/api/auth/token/", {"username": "dispatcher", "password": password}, format="json"
        )

    def test_endpoints_require_authentication(self):
        for url in ["/api/vehicles/", "/api/offices/summary/", "/api/mechanics/workload/", "/api/auth/me/"]:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 401, url)
        res = self.client.post("/api/offices/", {"name": "X", "city": "Y"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_login_returns_tokens_and_user(self):
        res = self.login()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(set(res.data), {"access", "refresh", "user"})
        self.assertEqual(res.data["user"]["username"], "dispatcher")

    def test_wrong_password_is_401_with_clear_message(self):
        res = self.login(password="nope")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data["detail"], "Incorrect username or password.")

    def test_access_token_grants_access(self):
        make_office(name="Austin", city="Austin")
        access = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get("/api/offices/").data["count"], 1)
        self.assertEqual(self.client.get("/api/auth/me/").data["username"], "dispatcher")

    def test_invalid_token_is_401(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")
        self.assertEqual(self.client.get("/api/vehicles/").status_code, 401)

    def test_refresh_rotates_and_blacklists_old_refresh_token(self):
        refresh = self.login().data["refresh"]
        res = self.client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertNotEqual(res.data["refresh"], refresh)
        reused = self.client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(reused.status_code, 401)

    def test_logout_blacklists_refresh_token(self):
        refresh = self.login().data["refresh"]
        res = self.client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, 205)
        res = self.client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, 401)
        # Logging out twice (or with a junk token) is harmless.
        self.assertEqual(
            self.client.post("/api/auth/logout/", {"refresh": "junk"}, format="json").status_code, 205
        )

    def test_inactive_user_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.login().status_code, 401)

    def test_login_is_throttled(self):
        statuses = [self.login(password="wrong").status_code for _ in range(11)]
        self.assertEqual(statuses[-1], 429)
