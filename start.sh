#!/bin/bash

echo "Activating the virtual environment..."
source venv/bin/activate

echo "Launching the API..."
python3 api.py &
API_PID=$!
sleep 3

echo "Launching the web app..."
cd frontend
yarn preview

kill $API_PID
