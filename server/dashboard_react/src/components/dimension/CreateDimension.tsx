import { useState } from 'react';
import { X, Save, FileJson } from 'lucide-react';
import axios from '../../api/axios';

interface CreateDimensionProps {
  application: string;
  organization: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateDimension({
  application,
  organization,
  onClose,
  onSuccess,
}: CreateDimensionProps) {
  const [formData, setFormData] = useState({
    dimension: '',
    schema: '{\n  "type": "string"\n}',
    description: '',
    mandatory: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isValidJson, setIsValidJson] = useState(true);

  const handleSchemaChange = (value: string) => {
    setFormData({ ...formData, schema: value });
    try {
      JSON.parse(value);
      setIsValidJson(true);
      setError('');
    } catch (e) {
      console.log(e);
      setIsValidJson(false);
      setError('Invalid JSON schema');
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      const payload = {
        ...formData,
        schema: JSON.parse(formData.schema)
      };

      await axios.post(
        `/organisations/applications/dimension/create`,
        payload,
        {
          headers: {
            'x-organisation': organization,
            'x-application': application
          }
        }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Failed to create dimension. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-opacity-95 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-8 w-3/4 max-w-4xl">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/20 p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center">
                <FileJson size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Create Dimension</h2>
                <p className="text-white/70">Add a new dimension to {application}</p>
              </div>
              <span className="px-4 py-2 text-sm bg-gradient-to-r from-purple-400/20 to-pink-400/20 text-purple-200 rounded-full border border-purple-300/30">
                {organization}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white/90 transition-colors duration-200"
            >
              <span className="sr-only">Close</span>
              <X size={24} />
            </button>
          </div>

          {/* Form */}
          <div className="p-8 space-y-6">
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Dimension Name */}
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Dimension Name
                </label>
                <input
                  type="text"
                  value={formData.dimension}
                  onChange={(e) => setFormData({ ...formData, dimension: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                  placeholder="Enter dimension name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                  placeholder="Enter dimension description"
                  rows={3}
                />
              </div>

              {/* Function Name
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Function Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.function_name}
                onChange={(e) => setFormData({ ...formData, function_name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50"
                  placeholder="Enter function name"
                />
              </div> */}

              {/* JSON Schema */}
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  JSON Schema
                </label>
                <textarea
                  value={formData.schema}
                  readOnly
                  onChange={(e) => handleSchemaChange(e.target.value)}
                  className={`w-full px-4 py-2 font-mono text-sm bg-white/5 border rounded-xl text-white cursor-not-allowed opacity-75 ${
                    isValidJson ? 'border-white/10' : 'border-red-500/50'
                  }`}
                  rows={8}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-white/20">
              <button
                onClick={onClose}
                className="px-6 py-3 text-sm font-medium text-white/90 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValidJson || !formData.dimension || isSubmitting}
                className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isValidJson && formData.dimension && !isSubmitting
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-white/5 text-white/40 cursor-not-allowed border border-white/10'
                }`}
              >
                <Save size={16} className="mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Dimension'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}