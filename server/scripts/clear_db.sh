#!/bin/bash
# Copyright 2025 Juspay Technologies
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
