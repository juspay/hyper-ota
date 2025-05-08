#!/bin/bash

read -p "Enter PostgreSQL username: " db_user

# Drop databases if they exist
psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS hyperotaserver;"
psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS config;"

# Create databases and assign owner
psql -d postgres -c "CREATE DATABASE hyperotaserver OWNER $db_user;"
psql -d postgres -c "CREATE DATABASE config OWNER $db_user;"

# Grant privileges
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE hyperotaserver TO $db_user;"
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE config TO $db_user;"
