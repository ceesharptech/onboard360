import React, { useState, useEffect, useRef } from "react";
import {
  FolderSimple,
  FilePdf,
  FileDoc,
  UploadSimple,
  Trash,
  ArrowsClockwise,
  MagnifyingGlass,
  DownloadSimple,
  Buildings,
  Globe,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  libraryDocumentApi,
  departmentApi,
} from "../../api/endpoints";
import type {
  LibraryDocument,
  Department,
  PaginationMeta,
} from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { Select } from "../../components/common/Select";
import { Pagination } from "../../components/common/Pagination";

export const DocumentLibrary: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Pagination State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadScope, setUploadScope] = useState<"company" | "department">(
    user?.role === "manager" ? "department" : "company"
  );
  const [uploadDeptId, setUploadDeptId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Replace Modal State
  const [targetDoc, setTargetDoc] = useState<LibraryDocument | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Delete Modal State
  const [deletingDoc, setDeletingDoc] = useState<LibraryDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load departments for HR Admin
  useEffect(() => {
    if (user?.role === "hr_admin") {
      departmentApi
        .list({ limit: 100 })
        .then((res) => {
          const list = Array.isArray(res) ? res : (res as any)?.data || [];
          setDepartments(list);
          if (list.length > 0 && !uploadDeptId) {
            setUploadDeptId(list[0].id);
          }
        })
        .catch(() => {});
    } else if (user?.departmentId) {
      setUploadDeptId(user.departmentId);
    }
  }, [user?.role, user?.departmentId]);

  // Fetch documents
  const fetchDocuments = async (
    targetPage = page,
    targetSearch = debouncedSearch,
    targetDept = selectedDeptFilter
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await libraryDocumentApi.list({
        page: targetPage,
        limit: 12,
        search: targetSearch || undefined,
        departmentId: targetDept || undefined,
      });

      const docs = Array.isArray(res) ? res : (res as any)?.data || [];
      setDocuments(docs);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load document library"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(page, debouncedSearch, selectedDeptFilter);
  }, [page, debouncedSearch, selectedDeptFilter]);

  // Handle Download
  const handleDownload = async (doc: LibraryDocument) => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(libraryDocumentApi.getDownloadUrl(doc.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error("Unable to download document. Access denied or file missing.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Download Failed", err.message || "Failed to download document");
    }
  };

  // Handle Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Missing File", "Please select a PDF or .docx file to upload");
      return;
    }

    setIsUploading(true);
    try {
      const deptId =
        user?.role === "manager"
          ? user.departmentId
          : uploadScope === "department"
          ? uploadDeptId
          : null;

      await libraryDocumentApi.upload(uploadFile, deptId);
      toast.success(
        "Document Uploaded",
        `"${uploadFile.name}" was successfully added to the library.`
      );
      setIsUploadModalOpen(false);
      setUploadFile(null);
      fetchDocuments(1, debouncedSearch, selectedDeptFilter);
    } catch (err: any) {
      toast.error("Upload Failed", err.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Replace
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDoc || !replaceFile) return;

    setIsReplacing(true);
    try {
      await libraryDocumentApi.replace(targetDoc.id, replaceFile);
      toast.success(
        "Document Replaced",
        `"${targetDoc.filename}" replaced with "${replaceFile.name}".`
      );
      setTargetDoc(null);
      setReplaceFile(null);
      fetchDocuments(page, debouncedSearch, selectedDeptFilter);
    } catch (err: any) {
      toast.error("Replacement Failed", err.message || "Failed to replace document");
    } finally {
      setIsReplacing(false);
    }
  };

  // Handle Delete
  const handleDeleteSubmit = async () => {
    if (!deletingDoc) return;

    setIsDeleting(true);
    try {
      await libraryDocumentApi.delete(deletingDoc.id);
      toast.success(
        "Document Deleted",
        `"${deletingDoc.filename}" was removed from the library.`
      );
      setDeletingDoc(null);
      fetchDocuments(page, debouncedSearch, selectedDeptFilter);
    } catch (err: any) {
      toast.error("Delete Failed", err.message || "Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  };

  const canManageDoc = (doc: LibraryDocument) => {
    if (user?.role === "hr_admin") return true;
    if (user?.role === "manager" && doc.departmentId === user.departmentId) return true;
    return false;
  };

  const canUpload = user?.role === "hr_admin" || user?.role === "manager";

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FolderSimple size={20} weight="bold" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Document Library
              </h1>
              <p className="text-xs text-[#8a8f98] mt-0.5">
                Company-wide policies, employee handbooks, and departmental documentation.
              </p>
            </div>
          </div>
        </div>

        {canUpload && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setUploadFile(null);
              setIsUploadModalOpen(true);
            }}
            icon={<Plus size={14} weight="bold" />}
          >
            Upload Document
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f98]"
          />
          <input
            type="text"
            placeholder="Search documents by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#101216] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {user?.role === "hr_admin" && (
            <select
              value={selectedDeptFilter}
              onChange={(e) => {
                setSelectedDeptFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-[#101216] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] focus:outline-none transition-colors"
              aria-label="Filter documents by department"
            >
              <option value="">All Documents</option>
              <option value="company_wide">Company-wide Only</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {(search || selectedDeptFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedDeptFilter("");
                setPage(1);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-400">
          <WarningCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Document Grid / Table Card */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8a8f98]">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-2" />
            <span className="text-xs">Loading library documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 px-4 text-[#8a8f98]">
            <FolderSimple size={36} className="mx-auto mb-2 text-[#565964]" />
            <p className="text-sm font-medium text-white mb-1">
              No documents found
            </p>
            <p className="text-xs max-w-sm mx-auto text-[#8a8f98]">
              {search || selectedDeptFilter
                ? "No library documents match the search or filter criteria."
                : canUpload
                ? "No documents in the library yet. Click 'Upload Document' to add your first policy or guide."
                : "No documents currently available for your department."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f7f8f8]">
              <thead className="bg-[#14161a] text-[#8a8f98] border-b border-white/[0.06] uppercase font-medium text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Visibility Scope</th>
                  <th className="py-3 px-4">Uploader</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {documents.map((doc) => {
                  const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
                  const isCompanyWide = !doc.departmentId;

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-[#14161a]/80 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-1.5 rounded ${
                              isPdf
                                ? "bg-red-500/10 text-red-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            {isPdf ? (
                              <FilePdf size={18} weight="fill" />
                            ) : (
                              <FileDoc size={18} weight="fill" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white truncate max-w-xs sm:max-w-md">
                              {doc.filename}
                            </div>
                            <div className="text-[11px] text-[#62666d]">
                              {isPdf ? "PDF Document" : "Word Document (.docx)"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isCompanyWide ? (
                          <Badge variant="blue" icon={<Globe size={11} />}>
                            Company-wide
                          </Badge>
                        ) : (
                          <Badge variant="green" icon={<Buildings size={11} />}>
                            {doc.department?.name || "Department"}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {doc.uploader?.email || "HR"}
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {new Date(doc.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="utility"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            icon={<DownloadSimple size={13} />}
                            title="Download or view document"
                          >
                            Download
                          </Button>

                          {canManageDoc(doc) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetDoc(doc);
                                  setReplaceFile(null);
                                }}
                                className="p-1.5 rounded text-[#8a8f98] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                                title="Replace document with new version"
                              >
                                <ArrowsClockwise size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingDoc(doc)}
                                className="p-1.5 rounded text-[#8a8f98] hover:text-[#f87171] hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete document from library"
                              >
                                <Trash size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.limit}
          onPageChange={(p) => setPage(p)}
        />
      </Card>

      {/* Upload Document Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Library Document"
        maxWidth="md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
          {/* File Selector */}
          <div>
            <label className="block text-xs font-medium text-[#f7f8f8] mb-1.5">
              Select Document (.pdf or .docx)
            </label>
            <div
              onClick={() => uploadInputRef.current?.click()}
              className="border border-dashed border-white/[0.15] hover:border-white/30 rounded-xl p-6 text-center cursor-pointer bg-[#101216]/50 transition-colors"
            >
              <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <UploadSimple size={28} className="mx-auto mb-2 text-indigo-400" />
              {uploadFile ? (
                <div>
                  <div className="font-semibold text-white">{uploadFile.name}</div>
                  <div className="text-[11px] text-[#8a8f98] mt-0.5">
                    {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-white font-medium">Click to browse file</div>
                  <div className="text-[11px] text-[#62666d] mt-0.5">
                    PDF or DOCX documents up to 15MB
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scope Selector */}
          {user?.role === "hr_admin" ? (
            <div className="p-3 bg-[#14161a] border border-white/[0.08] rounded-xl space-y-3">
              <label className="text-xs font-medium text-[#f7f8f8] block">
                Visibility Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUploadScope("company")}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all cursor-pointer text-left ${
                    uploadScope === "company"
                      ? "bg-white/[0.12] border-white/30 text-white"
                      : "bg-[#16181e] border-white/[0.06] text-[#8a8f98] hover:text-white"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    <Globe size={13} />
                    <span>Company-wide</span>
                  </div>
                  <div className="text-[10px] text-[#8a8f98] mt-0.5">
                    Visible to all company members
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadScope("department")}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all cursor-pointer text-left ${
                    uploadScope === "department"
                      ? "bg-white/[0.12] border-white/30 text-white"
                      : "bg-[#16181e] border-white/[0.06] text-[#8a8f98] hover:text-white"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    <Buildings size={13} />
                    <span>Department Only</span>
                  </div>
                  <div className="text-[10px] text-[#8a8f98] mt-0.5">
                    Restricted to a single department
                  </div>
                </button>
              </div>

              {uploadScope === "department" && (
                <Select
                  label="Target Department"
                  value={uploadDeptId}
                  onChange={(e) => setUploadDeptId(e.target.value)}
                  options={departments.map((d) => ({
                    value: d.id,
                    label: d.name,
                  }))}
                />
              )}
            </div>
          ) : (
            <div className="p-3 bg-[#14161a] border border-white/[0.08] rounded-xl text-xs space-y-1">
              <span className="text-[11px] text-[#8a8f98]">Visibility Scope:</span>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Buildings size={14} />
                <span>Scoped exclusively to your Department</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isUploading}
              disabled={!uploadFile}
            >
              Upload to Library
            </Button>
          </div>
        </form>
      </Modal>

      {/* Replace Document Modal */}
      <Modal
        isOpen={Boolean(targetDoc)}
        onClose={() => setTargetDoc(null)}
        title="Replace Library Document"
        maxWidth="sm"
      >
        <form onSubmit={handleReplaceSubmit} className="space-y-4 text-xs">
          <p className="text-[#8a8f98] leading-relaxed">
            Replacing <strong className="text-white">"{targetDoc?.filename}"</strong> will
            overwrite the file on disk. Any tasks linked to this document will seamlessly
            reference the updated file. No historical versions are retained.
          </p>

          <div
            onClick={() => replaceInputRef.current?.click()}
            className="border border-dashed border-white/[0.15] hover:border-white/30 rounded-xl p-6 text-center cursor-pointer bg-[#101216]/50 transition-colors"
          >
            <input
              ref={replaceInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setReplaceFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <ArrowsClockwise size={24} className="mx-auto mb-2 text-indigo-400" />
            {replaceFile ? (
              <div>
                <div className="font-semibold text-white">{replaceFile.name}</div>
                <div className="text-[11px] text-[#8a8f98] mt-0.5">
                  {(replaceFile.size / (1024 * 1024)).toFixed(2)} MB
                </div>
              </div>
            ) : (
              <div>
                <div className="text-white font-medium">Select replacement file</div>
                <div className="text-[11px] text-[#62666d] mt-0.5">
                  PDF or DOCX documents
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setTargetDoc(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isReplacing}
              disabled={!replaceFile}
            >
              Confirm Replacement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingDoc)}
        onClose={() => setDeletingDoc(null)}
        title="Delete Library Document"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400">
            <WarningCircle size={18} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-white">
                Delete "{deletingDoc?.filename}"?
              </div>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                This document will be permanently deleted from disk. Any template tasks or
                active employee tasks referencing this document will automatically have their
                link safely removed.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setDeletingDoc(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleDeleteSubmit}
              isLoading={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DocumentLibrary;
