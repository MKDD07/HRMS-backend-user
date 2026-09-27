import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Plus,
  Search,
  CheckCircle2,
  Shield,
  Monitor,
  Smartphone,
  HardDrive,
  UserCheck,
  Tag
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { Modal } from '../../components/ui/Modal';
import { FilterBar } from '../../components/ui/FilterBar';

export function AssetsPage({
  api,
  onShowToast
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Asset Form
  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState('Laptop');
  const [serialNo, setSerialNo] = useState('');
  const [assignedTo, setAssignedTo] = useState('Mohit Kataria');
  const [assignedId, setAssignedId] = useState('TYS-1021');

  const loadAssets = async () => {
    setLoading(true);
    try {
      const res = await api.getAssets();
      if (res.data) setAssets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleAddAsset = async (e) => {
    e.preventDefault();
    try {
      await api.createAsset({
        name: assetName,
        category,
        serial_number: serialNo,
        assigned_user: assignedTo,
        assigned_userid: assignedId,
        condition: 'Excellent',
        status: 'Assigned',
        issue_date: new Date().toISOString().split('T')[0]
      });

      setIsAddModalOpen(false);
      setAssetName('');
      setSerialNo('');
      await loadAssets();

      if (onShowToast) {
        onShowToast({
          type: 'success',
          title: 'Asset Allocated',
          message: `${assetName} registered to ${assignedTo}.`
        });
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast({
          type: 'error',
          title: 'Asset Error',
          message: err.message
        });
      }
    }
  };

  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const filteredAssets = assets.filter((a) => {
    const term = search.toLowerCase();
    const matchesSearch =
      (a.name || '').toLowerCase().includes(term) ||
      (a.serial_number || '').toLowerCase().includes(term) ||
      (a.assigned_user || '').toLowerCase().includes(term);
    const matchesCat = selectedCat === 'All' || a.category === selectedCat;
    const matchesStatus = selectedStatus === 'All' || a.status === selectedStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hardware & IT Asset Inventory"
        subtitle="Track company workstations, peripherals, warranty schedules, and hardware custodian assignments."
        breadcrumbs={['HRMS', 'Assets']}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsAddModalOpen(true)}
          >
            Allocate Asset
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Hardware Assets"
          value="176 Units"
          icon={Laptop}
          color="indigo"
          metaText="Laptops, screens, & test gear"
        />
        <StatCard
          label="Currently Deployed"
          value="158 Units"
          icon={UserCheck}
          color="green"
          metaText="Assigned to staff"
        />
        <StatCard
          label="In Central IT Pool"
          value="18 Units"
          icon={HardDrive}
          color="cyan"
          metaText="Ready for instant dispatch"
        />
        <StatCard
          label="Under AMC / Repair"
          value="2 Units"
          icon={Shield}
          color="amber"
          metaText="Apple authorized service"
        />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter assets by model, serial number, or assignee..."
      >
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="filter-bar__select text-[13px]"
        >
          <option value="All">All Categories</option>
          <option value="Laptop">Laptops</option>
          <option value="Workstation">Workstations</option>
          <option value="Monitor">Monitors</option>
          <option value="Smartphone">Smartphones</option>
          <option value="Peripherals">Peripherals & Audio</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="filter-bar__select text-[13px]"
        >
          <option value="All">All Statuses</option>
          <option value="Assigned">Assigned</option>
          <option value="In Stock">In Stock / Pool</option>
          <option value="Maintenance">Maintenance</option>
        </select>
      </FilterBar>

      {/* Table */}
      <div className="card p-0 overflow-hidden bg-white border border-[#E5E7EB]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#F9FAFB] text-[#5F6368] font-semibold border-b border-[#E5E7EB] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Hardware Item</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Serial Number</th>
                <th className="py-3.5 px-4">Custodian / Assignee</th>
                <th className="py-3.5 px-4">Issue Date</th>
                <th className="py-3.5 px-4">Condition</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6] text-[#27292C]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#5F6368]">
                    No hardware assets found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#27292C]">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-[#5F6368]">
                      {item.category}
                    </td>
                    <td className="py-3 px-4 text-[#4F46E5] text-[11px] font-semibold">
                      {item.serial_number}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#27292C]">{item.assigned_user}</p>
                      <p className="text-[11px] text-[#5F6368] font-mono">{item.assigned_userid}</p>
                    </td>
                    <td className="py-3 px-4 text-[#5F6368] text-[11px]">
                      {item.issue_date}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-[#F3F4F6] text-[#27292C] font-medium border border-[#E5E7EB]">
                        {item.condition}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={item.status === 'Assigned' ? 'success' : 'neutral'}>
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register & Allocate Hardware Asset"
      >
        <form onSubmit={handleAddAsset} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-slate-300 mb-1">
              Asset Model & Name *
            </label>
            <input
              type="text"
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. MacBook Pro 16 M3 Max (32GB / 1TB)"
              className="w-full text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 text-[13px]"
              >
                <option value="Laptop">Laptop Workstation</option>
                <option value="Display">Display Monitor</option>
                <option value="Mobile">Test Mobile Device</option>
                <option value="Accessory">Peripheral / Dock</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Serial Number *
              </label>
              <input
                type="text"
                required
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="e.g. C02G90XXMD6M"
                className="w-full text-[13px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Assigned Employee Name
              </label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-300 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={assignedId}
                onChange={(e) => setAssignedId(e.target.value)}
                className="w-full text-[13px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Confirm Asset Allocation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
