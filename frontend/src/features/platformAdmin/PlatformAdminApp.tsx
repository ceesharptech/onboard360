import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Buildings,
  Users,
  TreeStructure,
  SignOut,
  Plus,
  MagnifyingGlass,
  ArrowLeft,
  Copy,
  Check,
  VideoCamera,
  FolderOpen,
  WarningCircle,
  Buildings as CompanyIcon,
} from "@phosphor-icons/react";
import {
  platformAdminApi,
  type PlatformAdmin,
  type CompanySummary,
  type CompanyDetail,
} from "../../api/platformAdminClient";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";

export const PlatformAdminApp: React.FC = () => {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Dashboard state
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Drilldown state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [companyDetail, setCompanyDetail] = useState<CompanyDetail | null>(
    null,
  );
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Onboarding Modal state
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newHrEmail, setNewHrEmail] = useState("");
  const [newHrPassword, setNewHrPassword] = useState("");
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardSuccessData, setOnboardSuccessData] = useState<{
    companyName: string;
    hrAdminEmail: string;
    temporaryPassword?: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Verify authentication on mount
  useEffect(() => {
    const token = platformAdminApi.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    platformAdminApi
      .getMe()
      .then((adminData) => {
        setAdmin(adminData);
      })
      .catch(() => {
        platformAdminApi.clearToken();
        setAdmin(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Fetch companies when authenticated or query changes
  useEffect(() => {
    if (!admin) return;
    fetchCompanies(currentPage, searchQuery);
  }, [admin, currentPage, searchQuery]);

  const fetchCompanies = async (page: number, search: string) => {
    setLoadingCompanies(true);
    try {
      const res = await platformAdminApi.listCompanies({
        page,
        limit: 10,
        search: search.trim() || undefined,
      });
      setCompanies(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      console.error("Failed to load companies:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmittingLogin(true);

    try {
      const res = await platformAdminApi.login(loginEmail, loginPassword);
      setAdmin(res.admin);
      setLoginPassword("");
    } catch (err: any) {
      setLoginError(
        err.message || "Authentication failed. Please verify credentials.",
      );
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleLogout = () => {
    platformAdminApi.clearToken();
    setAdmin(null);
    setSelectedCompanyId(null);
    setCompanyDetail(null);
  };

  const handleSelectCompany = async (id: string) => {
    setSelectedCompanyId(id);
    setLoadingDetail(true);
    try {
      const detail = await platformAdminApi.getCompany(id);
      setCompanyDetail(detail);
    } catch (err: any) {
      console.error("Failed to fetch company details:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setOnboardingSubmitting(true);

    try {
      const result = await platformAdminApi.createCompany({
        companyName: newCompanyName.trim(),
        hrAdminEmail: newHrEmail.trim(),
        hrAdminPassword: newHrPassword.trim() || undefined,
      });

      setOnboardSuccessData({
        companyName: result.company.name,
        hrAdminEmail: result.hrAdmin.email,
        temporaryPassword:
          newHrPassword.trim() || "Auto-generated (shared with HR)",
      });

      // Reset form and refresh list
      setNewCompanyName("");
      setNewHrEmail("");
      setNewHrPassword("");
      fetchCompanies(1, searchQuery);
    } catch (err: any) {
      setOnboardError(err.message || "Failed to onboard company");
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  const handleCopyPassword = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center text-[#8a8f98]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-xs font-medium tracking-wide text-[#8a8f98]">
            Verifying Platform Admin access...
          </span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // LOGIN VIEW (Monochrome Linear Dark Mode)
  // -------------------------------------------------------------
  if (!admin) {
    return (
      <div className="min-h-screen bg-[#08080a] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm">
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-9 h-9 rounded-lg bg-[#14161a] border border-white/[0.08] flex items-center justify-center mb-3 text-[#f7f8f8]">
              <ShieldCheck size={18} weight="bold" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[#f7f8f8] m-0">
              Platform Administration
            </h1>
            <p className="text-xs text-[#8a8f98] mt-1">
              Internal tenant management & fleet console
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-[#0b0c0e] border border-white/[0.08] rounded-xl p-6 sm:p-7 shadow-xs text-left">
            <h2 className="text-base font-medium text-[#f7f8f8] tracking-tight mb-1">
              Console Sign In
            </h2>
            <p className="text-xs text-[#8a8f98] mb-5">
              Enter your master platform administrator credentials.
            </p>

            {loginError && (
              <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-400">
                <WarningCircle size={15} weight="fill" className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Admin Email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@platform.internal"
                autoComplete="email"
              />

              <Input
                label="Master Password"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
              />

              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={submittingLogin}
                  className="w-full"
                >
                  Enter Console
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center text-[11px] text-[#565961]">
            Restricted access. All platform actions are audited.
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED PLATFORM CONSOLE VIEW (Linear Monochrome Dark Mode)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#08080a] text-[#f7f8f8] flex flex-col font-sans">
      {/* Top Console Navigation Bar */}
      <header className="h-14 border-b border-white/[0.06] bg-[#08080a]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-medium text-sm tracking-tight text-[#f7f8f8]">
              Onboard360
            </span>
            <span className="text-[#3a3f4a]">•</span>
            <span className="text-xs text-[#8a8f98]">Fleet Console</span>
            <Badge variant="gray" size="sm">
              Platform Admin
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-[#8a8f98] bg-[#0f1013] border border-white/[0.06] px-2.5 py-1 rounded-md flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px] text-[#d0d6e0]">
              {admin.email}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={<SignOut size={14} />}
            onClick={handleLogout}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* If viewing a single company drilldown */}
        {selectedCompanyId ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowLeft size={14} />}
                onClick={() => {
                  setSelectedCompanyId(null);
                  setCompanyDetail(null);
                }}
              >
                Back to All Companies
              </Button>
            </div>

            {loadingDetail || !companyDetail ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#8a8f98]">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-xs">Loading company details...</span>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Company Header Card */}
                <Card className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold text-[#f7f8f8] tracking-tight">
                          {companyDetail.company?.name || companyDetail.name}
                        </h2>
                        <Badge variant="green" size="sm">
                          Active Tenant
                        </Badge>
                      </div>
                      <div className="text-xs text-[#8a8f98] mt-2 flex items-center gap-3">
                        <span className="font-mono text-[#5a5e6b]">
                          ID: {companyDetail.company?.id || companyDetail.id}
                        </span>
                        <span>•</span>
                        <span>
                          Provisioned:{" "}
                          {new Date(
                            companyDetail.company?.createdAt ||
                              companyDetail.createdAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {companyDetail.hrAdmin && (
                      <div className="bg-[#14161a] border border-white/[0.08] p-3.5 rounded-lg text-xs space-y-1 min-w-[240px]">
                        <div className="text-[10px] uppercase font-semibold text-[#8a8f98] tracking-wider">
                          Primary HR Administrator
                        </div>
                        <div className="font-medium text-[#f7f8f8]">
                          {companyDetail.hrAdmin.email}
                        </div>
                        <div className="text-[11px] text-[#8a8f98] pt-0.5">
                          Status:{" "}
                          <span
                            className={
                              companyDetail.hrAdmin.mustChangePassword
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }
                          >
                            {companyDetail.hrAdmin.mustChangePassword
                              ? "Pending Password Setup"
                              : "Account Active"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Tenant Telemetry Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <Card className="p-4">
                    <div className="flex items-center justify-between text-[#8a8f98] mb-2">
                      <span className="text-[11px] font-medium uppercase tracking-wider">
                        Employees
                      </span>
                      <Users size={16} className="text-[#8a8f98]" />
                    </div>
                    <div className="text-2xl font-semibold text-[#f7f8f8]">
                      {companyDetail.stats?.totalEmployees ??
                        companyDetail.employeeCount ??
                        0}
                    </div>
                    <div className="text-[11px] text-[#5a5e6b] mt-1">
                      Total active profiles
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between text-[#8a8f98] mb-2">
                      <span className="text-[11px] font-medium uppercase tracking-wider">
                        Departments
                      </span>
                      <TreeStructure size={16} className="text-[#8a8f98]" />
                    </div>
                    <div className="text-2xl font-semibold text-[#f7f8f8]">
                      {companyDetail.stats?.totalDepartments ??
                        companyDetail.departmentCount ??
                        0}
                    </div>
                    <div className="text-[11px] text-[#5a5e6b] mt-1">
                      Configured divisions
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between text-[#8a8f98] mb-2">
                      <span className="text-[11px] font-medium uppercase tracking-wider">
                        Templates
                      </span>
                      <FolderOpen size={16} className="text-[#8a8f98]" />
                    </div>
                    <div className="text-2xl font-semibold text-[#f7f8f8]">
                      {companyDetail.stats?.totalTemplates ??
                        companyDetail.templateCount ??
                        0}
                    </div>
                    <div className="text-[11px] text-[#5a5e6b] mt-1">
                      Workflow templates
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between text-[#8a8f98] mb-2">
                      <span className="text-[11px] font-medium uppercase tracking-wider">
                        Content Assets
                      </span>
                      <VideoCamera size={16} className="text-[#8a8f98]" />
                    </div>
                    <div className="text-2xl font-semibold text-[#f7f8f8]">
                      {(companyDetail.stats?.totalDocuments ??
                        companyDetail.documentCount ??
                        0) +
                        (companyDetail.stats?.totalTrainingEntries ??
                          companyDetail.trainingEntryCount ??
                          0)}
                    </div>
                    <div className="text-[11px] text-[#5a5e6b] mt-1">
                      Docs & Guides uploaded
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Companies Overview Table View */
          <>
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <Card className="p-5">
                <div className="flex items-center justify-between text-[#8a8f98] mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    Total Tenants
                  </span>
                  <Buildings size={16} className="text-[#8a8f98]" />
                </div>
                <div className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">
                  {totalCount}
                </div>
                <div className="text-[11px] text-[#5a5e6b] mt-1">
                  Active enterprise workspaces
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between text-[#8a8f98] mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    Managed Workforce
                  </span>
                  <Users size={16} className="text-[#8a8f98]" />
                </div>
                <div className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">
                  {companies.reduce(
                    (sum, c) =>
                      sum + (c._count?.employees || c.employeeCount || 0),
                    0,
                  )}
                </div>
                <div className="text-[11px] text-[#5a5e6b] mt-1">
                  Aggregated employee roster
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between text-[#8a8f98] mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    Total Departments
                  </span>
                  <TreeStructure size={16} className="text-[#8a8f98]" />
                </div>
                <div className="text-2xl font-semibold text-[#f7f8f8] tracking-tight">
                  {companies.reduce(
                    (sum, c) =>
                      sum + (c._count?.departments || c.departmentCount || 0),
                    0,
                  )}
                </div>
                <div className="text-[11px] text-[#5a5e6b] mt-1">
                  Org units across all tenants
                </div>
              </Card>
            </div>

            {/* Management Filter & Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#565961]"
                />
                <input
                  type="text"
                  placeholder="Filter companies..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#0a0b0d] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/40 focus:ring-1 focus:ring-white/20 rounded-md pl-8.5 pr-3 py-1.5 text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-none transition-colors"
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} weight="bold" />}
                onClick={() => {
                  setOnboardSuccessData(null);
                  setOnboardError(null);
                  setIsOnboardModalOpen(true);
                }}
              >
                Onboard Company
              </Button>
            </div>

            {/* Companies Table */}
            <div className="bg-[#0b0c0e] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f1013] border-b border-white/[0.06] text-[#8a8f98] uppercase tracking-wider text-[11px] font-medium">
                    <tr>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">HR Admin Contact</th>
                      <th className="py-3 px-4">Employees</th>
                      <th className="py-3 px-4">Departments</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {loadingCompanies ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-[#8a8f98]"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <span className="text-xs">
                              Loading registered tenants...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : companies.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-[#8a8f98]"
                        >
                          No companies match the current filter.
                        </td>
                      </tr>
                    ) : (
                      companies.map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                          onClick={() => handleSelectCompany(c.id)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-[#f7f8f8] group-hover:text-white transition-colors">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-[#5a5e6b] font-mono mt-0.5">
                              {c.id}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#8a8f98]">
                            {c.hrAdmin ? (
                              <span className="text-[#d0d6e0]">
                                {c.hrAdmin.email}
                              </span>
                            ) : (
                              <span className="text-[#5a5e6b] italic">
                                None provisioned
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[#f7f8f8]">
                            {c._count?.employees ?? c.employeeCount ?? 0}
                          </td>
                          <td className="py-3.5 px-4 text-[#f7f8f8]">
                            {c._count?.departments ?? c.departmentCount ?? 0}
                          </td>
                          <td className="py-3.5 px-4 text-[#8a8f98]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="utility"
                              size="sm"
                              onClick={() => handleSelectCompany(c.id)}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-white/[0.06] bg-[#0b0c0e] flex items-center justify-between text-xs text-[#8a8f98]">
                  <span>
                    Page {currentPage} of {totalPages} ({totalCount} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* ONBOARD NEW COMPANY MODAL */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <CompanyIcon size={18} className="text-[#f7f8f8]" />
            <span className="font-normal">
              {onboardSuccessData ? "Tenant Provisioned" : "Onboard New Tenant"}
            </span>
          </div>
        }
        maxWidth="md"
      >
        {onboardSuccessData ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-400">
              <Check size={16} weight="bold" />
              <span>Company and HR Admin provisioned atomically.</span>
            </div>

            <div className="bg-[#14161a] border border-white/[0.08] rounded-lg p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#8a8f98]">Company Legal Name</span>
                <span className="text-[#f7f8f8] font-medium">
                  {onboardSuccessData.companyName}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#8a8f98]">Initial HR Admin Email</span>
                <span className="text-[#f7f8f8] font-mono">
                  {onboardSuccessData.hrAdminEmail}
                </span>
              </div>
              {onboardSuccessData.temporaryPassword && (
                <div className="pt-1.5 space-y-1.5">
                  <span className="text-[#8a8f98] block">
                    Temporary Initial Password
                  </span>
                  <div className="flex items-center justify-between bg-[#0a0b0d] border border-white/[0.08] px-3 py-2 rounded-md font-mono text-xs text-[#f7f8f8]">
                    <span className="select-all">
                      {onboardSuccessData.temporaryPassword}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleCopyPassword(
                          onboardSuccessData.temporaryPassword!,
                        )
                      }
                    >
                      {copiedPassword ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-[#8a8f98]">
                    The administrator must change this password on their first
                    login.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsOnboardModalOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateCompany} className="space-y-4">
            <p className="text-xs text-[#8a8f98] mb-2">
              Provisions a new isolated organization and provisions their
              primary HR Administrator account atomically.
            </p>

            {onboardError && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-xs text-red-400">
                <WarningCircle
                  size={15}
                  weight="fill"
                  className="shrink-0 mt-0.5"
                />
                <span>{onboardError}</span>
              </div>
            )}

            <Input
              label="Company Legal Name *"
              required
              placeholder="e.g. Acme Industries Ltd."
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
            />

            <Input
              label="Initial HR Admin Email *"
              type="email"
              required
              placeholder="hr.director@acme.com"
              value={newHrEmail}
              onChange={(e) => setNewHrEmail(e.target.value)}
            />

            <Input
              label="Initial Password (Optional)"
              type="text"
              placeholder="Leave empty to auto-generate temporary password"
              value={newHrPassword}
              onChange={(e) => setNewHrPassword(e.target.value)}
              helperText="The user will be required to change this password on first login."
            />

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/[0.06]">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setIsOnboardModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={onboardingSubmitting}
              >
                Provision Tenant
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
