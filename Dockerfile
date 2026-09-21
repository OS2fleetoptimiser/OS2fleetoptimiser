FROM python:3.10-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    POETRY_VIRTUALENVS_CREATE=false

WORKDIR /fleetmanager

RUN apt-get update &&\
    apt-get install -y unixodbc iproute2 unixodbc-dev gnupg curl libxml2-dev libpq-dev libxslt-dev libxmlsec1-dev &&\
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg &&\
    echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list &&\
    apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql17 msodbcsql18 mssql-tools18 &&\
    pip install poetry==2.2.1

COPY poetry.lock pyproject.toml ./
RUN poetry install --without dev --no-root
ADD fleetmanager ./fleetmanager

RUN poetry install --only-root

RUN ["/bin/sh", "-c", "pytest fleetmanager/tests/"]
