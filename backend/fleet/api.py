from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class StandardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 200


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, ProtectedError):
        model_names = sorted({str(obj._meta.verbose_name_plural) for obj in exc.protected_objects})
        return Response(
            {
                "detail": (
                    "Cannot delete this record because it is still referenced by "
                    f"{', '.join(model_names)}. Deactivate or reassign them first."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )
    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "The change conflicts with existing data (duplicate or invalid reference)."},
            status=status.HTTP_409_CONFLICT,
        )
    return None
