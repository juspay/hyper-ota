interface CreateOrganizationProps {
  newOrgName: string;
  onOrgNameChange: (name: string) => void;
  onCreateOrg: () => void;
}

export default function CreateOrganization({
  newOrgName,
  onOrgNameChange,
  onCreateOrg,
}: CreateOrganizationProps) {
  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">
        Create Organisation
      </h2>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="orgName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Organisation Name
          </label>
          <input
            id="orgName"
            type="text"
            value={newOrgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
            placeholder="Enter organisation name"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={onCreateOrg}
          disabled={!newOrgName.trim()}
          className={`px-4 py-2 rounded-md font-medium ${
            newOrgName.trim()
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          Create Organisation
        </button>
      </div>
    </div>
  );
}
