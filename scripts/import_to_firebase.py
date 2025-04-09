import pandas as pd
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import re
from datetime import datetime
import time

# Path to your service account key file
SERVICE_ACCOUNT_PATH = '../cadd-vault-f8fc0-firebase-adminsdk-fbsvc-00b680a960.json'

# Initialize Firebase Admin
print(f"Initializing Firebase with service account: {SERVICE_ACCOUNT_PATH}")
try:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
    print("Firebase app initialized successfully")
except Exception as e:
    print(f"Error initializing Firebase app: {e}")
    exit(1)

# Initialize Firestore client
try:
    db = firestore.client()
    print("Firestore client initialized successfully")
    
    # Test connection with a small write operation
    test_ref = db.collection('test').document('connection_test')
    test_ref.set({'timestamp': firestore.SERVER_TIMESTAMP})
    print("Test write successful - database connection confirmed")
    test_ref.delete()  # Clean up test document
except Exception as e:
    print(f"Error connecting to Firestore: {e}")
    print("\nPossible solutions:")
    print("1. Make sure you've created a Firestore database in Firebase Console")
    print("2. Verify your service account has correct permissions")
    print("3. Check if you've selected the correct region for your database")
    print("4. Try creating the database through the direct link:")
    print("   https://console.cloud.google.com/firestore/data?project=cadd-vault")
    exit(1)

# Load CSV data
print("Loading CSV data...")
try:
    df = pd.read_csv('../tagged_cadd_vault_data.csv')
    print(f"Loaded {len(df)} records from CSV")
except Exception as e:
    print(f"Error loading CSV data: {e}")
    exit(1)

# Clean and convert data types
def clean_data(df):
    print("Cleaning and converting data...")
    # Handle missing values
    df = df.fillna('')
    
    # Convert numeric columns
    numeric_cols = ['GITHUB_STARS', 'CITATIONS', 'JIF']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col] = df[col].fillna(0)
    
    # Process date columns
    if 'LAST_COMMIT' in df.columns and df['LAST_COMMIT'].any():
        df['LAST_COMMIT'] = pd.to_datetime(df['LAST_COMMIT'], errors='coerce')
        # Convert timestamps to string format that Firestore can handle
        df['LAST_COMMIT'] = df['LAST_COMMIT'].dt.strftime('%Y-%m-%dT%H:%M:%S')
    
    # Convert tags to array if they're in a string format
    if 'TAGS' in df.columns:
        df['TAGS'] = df['TAGS'].apply(lambda x: x.split(',') if isinstance(x, str) and x else [])
    
    return df

# Create a safe document ID by sanitizing characters
def sanitize_doc_id(name):
    if not isinstance(name, str) or not name:
        return 'unnamed_package_' + str(int(time.time()))
    
    # Replace any characters that could cause path issues
    sanitized = name.replace(' ', '_')
    sanitized = re.sub(r'[^\w]', '_', sanitized)  # Replace non-alphanumeric & underscore chars
    
    # Ensure ID doesn't start with a number (Firestore requirement)
    if sanitized and sanitized[0].isdigit():
        sanitized = 'pkg_' + sanitized
        
    # Limit length to avoid issues
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
        
    return sanitized.lower()

df = clean_data(df)

# Upload to Firestore
batch_size = 250  # Reduced batch size for better error handling
total_records = len(df)
batches = (total_records // batch_size) + (1 if total_records % batch_size > 0 else 0)

print(f"Uploading {total_records} records in {batches} batches...")

uploaded_count = 0
error_count = 0

for batch_num in range(batches):
    start_idx = batch_num * batch_size
    end_idx = min((batch_num + 1) * batch_size, total_records)
    
    try:
        batch = db.batch()
        
        for _, row in df.iloc[start_idx:end_idx].iterrows():
            # Create a safe document ID
            doc_id = sanitize_doc_id(row['ENTRY NAME'])
            doc_ref = db.collection('packages').document(doc_id)
            
            # Create a dictionary with the row data
            package_data = row.to_dict()
            
            # Add metadata
            package_data['createdAt'] = firestore.SERVER_TIMESTAMP
            package_data['updatedAt'] = firestore.SERVER_TIMESTAMP
            package_data['userRatings'] = {}  # Initialize empty ratings object
            package_data['averageRating'] = 0.0
            package_data['ratingCount'] = 0
            
            # Add original entry name as searchable field
            package_data['originalName'] = row['ENTRY NAME']
            
            batch.set(doc_ref, package_data)
        
        # Commit the batch
        batch.commit()
        uploaded_count += end_idx - start_idx
        print(f"Uploaded batch {batch_num + 1}/{batches} successfully ({uploaded_count}/{total_records})")
        
        # Small delay to avoid overwhelming Firestore
        time.sleep(1)
        
    except Exception as e:
        error_count += 1
        print(f"Error uploading batch {batch_num + 1}: {e}")
        
        # If multiple batches fail, abort
        if error_count >= 3:
            print("Too many errors, aborting import")
            break
        
        # Wait longer before retrying
        time.sleep(5)

print(f"Upload complete! Successfully uploaded {uploaded_count} records.")
if error_count > 0:
    print(f"Encountered {error_count} batch errors during upload.")