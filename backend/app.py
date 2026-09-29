from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import pandas as pd
import json

app = Flask(__name__)
CORS(app)

# Load saved objects from the model/ folder (one level up from backend/)
with open('../model/scaler.pkl', 'rb') as f:
    scaler = pickle.load(f)
with open('../model/kmeans_model.pkl', 'rb') as f:
    kmeans = pickle.load(f)
with open('../model/cluster_names.json', 'r') as f:
    cluster_names = json.load(f)

cluster_profile = pd.read_csv('../model/cluster_profile.csv', index_col='Cluster')

FEATURES = ['BALANCE', 'PURCHASES', 'ONEOFF_PURCHASES', 'INSTALLMENTS_PURCHASES',
            'CASH_ADVANCE', 'CREDIT_LIMIT', 'PAYMENTS', 'MINIMUM_PAYMENTS',
            'PRC_FULL_PAYMENT', 'TENURE']

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    input_df = pd.DataFrame([data], columns=FEATURES)
    scaled_input = scaler.transform(input_df.values)
    cluster = int(kmeans.predict(scaled_input)[0])


    return jsonify({
        'cluster': cluster,
        'segment_name': cluster_names[str(cluster)],
     
    })
@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded. Send a CSV under the "file" field.'}), 400

    file = request.files['file']

    try:
        batch_df = pd.read_csv(file)
    except Exception:
        return jsonify({'error': 'Could not read the file as a CSV.'}), 400

    missing = [f for f in FEATURES if f not in batch_df.columns]
    if missing:
        return jsonify({'error': f'CSV is missing required columns: {missing}'}), 400

    # Keep only the columns the model expects, in the right order
    model_input = batch_df[FEATURES].copy()

    # Fill any missing values per row with 0 so a bad cell doesn't crash the whole batch
    model_input = model_input.fillna(0)

    scaled = scaler.transform(model_input.values)
    clusters = kmeans.predict(scaled)

    results = []
    for i, cluster in enumerate(clusters):
        row = batch_df.iloc[i]
        results.append({
            'row': int(i) + 1,
            'customer_id': str(row.get('CUST_ID', f'Row {i + 1}')),
            'cluster': int(cluster),
            'segment_name': cluster_names[str(int(cluster))],
        })

    # Segment breakdown counts, for the summary chart
    summary = {}
    for name in cluster_names.values():
        summary[name] = sum(1 for r in results if r['segment_name'] == name)

    return jsonify({
        'total_customers': len(results),
        'results': results,
        'summary': summary,
    })
@app.route('/segments', methods=['GET'])
def segments():
    return jsonify({
        'profiles': cluster_profile.reset_index().to_dict(orient='records'),
        'names': cluster_names
    })

if __name__ == '__main__':
    import os
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))

    FEATURE_RANGES = {
    'BALANCE': (0, 19000),
    'PURCHASES': (0, 49000),
    'ONEOFF_PURCHASES': (0, 40000),
    'INSTALLMENTS_PURCHASES': (0, 22000),
    'CASH_ADVANCE': (0, 47000),
    'CREDIT_LIMIT': (0, 30000),
    'PAYMENTS': (0, 50000),
    'MINIMUM_PAYMENTS': (0, 76000),
    'PRC_FULL_PAYMENT': (0, 1),
    'TENURE': (1, 12),
}
BUFFER = 0.15  # 15% slack beyond the observed min/max before flagging

def check_out_of_range(data):
    flags = []
    for key, (low, high) in FEATURE_RANGES.items():
        val = float(data.get(key, 0))
        span = high - low if high > low else 1
        buffered_low = low - span * BUFFER
        buffered_high = high + span * BUFFER
        if val < buffered_low or val > buffered_high:
            flags.append(key)
    return flags