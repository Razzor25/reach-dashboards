"use client";

import { useState } from "react";
import { 
  introspectTableFields, 
  testQomQuery, 
  testInteractionTypeQuery, 
  getAllTables,
  getInteractionTypeFields,
  testQomRefQuery
} from "@/features/reach/actions/schema-introspection-actions";

export default function SchemaIntrospectionPage() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<string[]>([]);

  const handleIntrospect = async (tableName: string) => {
    setLoading(true);
    try {
      const data = await introspectTableFields(tableName);
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  const handleGetAllTables = async () => {
    setLoading(true);
    try {
      const data = await getAllTables();
      setResult(JSON.stringify(data, null, 2));
      if (data.success && data.tables) {
        setTables(data.tables);
      }
    } catch (error) {
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  const handleTestQuery = async () => {
    setLoading(true);
    try {
      const data = await testQomQuery();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  const handleTestInteractionType = async () => {
    setLoading(true);
    try {
      const data = await testInteractionTypeQuery();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  const handleGetInteractionTypeFields = async () => {
    setLoading(true);
    try {
      const data = await getInteractionTypeFields();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  const handleTestQomRef = async () => {
    setLoading(true);
    try {
      const data = await testQomRefQuery();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">REACH Schema Introspection</h1>
      
      <div className="space-y-4 mb-6">
        <div>
          <button
            onClick={handleGetAllTables}
            disabled={loading}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 font-semibold"
          >
            📋 Get All Tables (Start Here!)
          </button>
        </div>
        
        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">🔍 Complete Field Lists:</h2>
          
          <div className="space-y-2">
            <button
              onClick={handleGetInteractionTypeFields}
              disabled={loading}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 mr-2 font-semibold"
            >
              📝 qom_interaction_type - ALL 19 Fields
            </button>
            
            <button
              onClick={() => handleIntrospect("qom_qom_interaction")}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 mr-2"
            >
              📝 qom_qom_interaction - ALL 27 Fields
            </button>
            
            <button
              onClick={() => handleIntrospect("qom_ref")}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 mr-2"
            >
              📝 qom_ref (reference data)
            </button>
            
            <button
              onClick={() => handleIntrospect("dw_questnr_rspn_dtl")}
              disabled={loading}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 mr-2"
            >
              📝 dw_questnr_rspn_dtl
            </button>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">▶️ Test Queries (Sample Data):</h2>
          
          <div className="space-y-2">
            <button
              onClick={handleTestQuery}
              disabled={loading}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 mr-2"
            >
              ▶️ Test QOM Interaction Query
            </button>

            <button
              onClick={handleTestInteractionType}
              disabled={loading}
              className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50 mr-2"
            >
              ▶️ Test Interaction Type Query
            </button>

            <button
              onClick={handleTestQomRef}
              disabled={loading}
              className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50 mr-2"
            >
              ▶️ Test qom_ref Query (Interaction Type Names?)
            </button>
          </div>
        </div>
      </div>
      
      {loading && <p className="mt-4 text-blue-600 font-semibold">Loading...</p>}
      
      {tables.length > 0 && (
        <div className="mt-4 mb-4">
          <h3 className="text-lg font-semibold mb-2">Quick Table Introspection:</h3>
          <div className="flex flex-wrap gap-2">
            {tables.slice(0, 20).map((table) => (
              <button
                key={table}
                onClick={() => handleIntrospect(table)}
                disabled={loading}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50 text-sm"
              >
                {table}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {result && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Result:</h3>
          <pre className="p-4 bg-gray-100 rounded overflow-auto max-h-96 text-xs">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
