interface CreateOrganizationProps {
  newOrgName: string;
  onOrgNameChange: (name: string) => void;
  onCreateOrg: () => void;
  onCancel?: () => void; // Optional: Add onCancel if you want a cancel button
}

export default function CreateOrganization({
  newOrgName,
  onOrgNameChange,
  onCreateOrg,
  onCancel, 
}: CreateOrganizationProps) {
  return (
    <div className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-slate-700/50 max-w-lg mx-auto font-sans">
      <h2 className="text-2xl font-semibold mb-6 text-slate-100">
        Create New Organisation
      </h2>
      <div className="space-y-6">
        <div>
          <label
            htmlFor="orgName"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Organisation Name
          </label>
          <input
            id="orgName"
            type="text"
            value={newOrgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
            placeholder="Enter organisation name"
            className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto flex justify-center py-2.5 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onCreateOrg}
            disabled={!newOrgName.trim()}
            className={`w-full sm:flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              newOrgName.trim()
                ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500"
                : "bg-slate-600 text-slate-400 cursor-not-allowed"
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-70`}
          >
            Create Organisation
          </button>
        </div>
      </div>
    </div>
  );
}
