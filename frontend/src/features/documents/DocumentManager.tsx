import React, { useState, useEffect, useRef } from "react";
import type { DocumentItem, RetrievedChunkItem, PaginationMeta } from "../../api/endpoints";
import { documentApi } from "../../api/endpoints";
import { useToast } from "../../context/ToastContext";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { Input } from "../../components/common/Input";
import { Pagination } from "../../components/common/Pagination";
import {
  FileText,
  FileDoc,
  FilePdf,
  UploadSimple,
  Trash,
  ArrowsClockwise,
  MagnifyingGlass,
  CheckCircle,
  WarningCircle,
  Clock,
  Sparkle,
  X,
} from "@phosphor-icons/react";

export const DocumentManager: React.FC = () => {
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Replace Modal State
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [targetDoc, setTargetDoc] = useState<DocumentItem | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Similarity Retrieval Sandbox State
  const [searchQuery, setSearchQuery] = useState("how do I apply for leave");
  const [isSearching, setIsSearching] = useState(false);
  const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunkItem[]>(
    [],
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Search & Pagination State (Phase 5.3)
  const [docSearch, setDocSearch] = useState("");
  const [debouncedDocSearch, setDebouncedDocSearch] = useState("");
  const [docPage, setDocPage] = useState(1);
  const [docPagination, setDocPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const isInitialMount = React.useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDocSearch(docSearch);
      setDocPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [docSearch]);

  const fetchDocuments = async (page = docPage, search = debouncedDocSearch) => {
    try {
      setError(null);
      const res = await documentApi.list({
        page,
        limit: 20,
        search: search || undefined,
      });
      const docs = res.documents || (Array.isArray(res) ? res : []);
      setDocuments(docs);
      if (res.pagination) {
        setDocPagination(res.pagination);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchDocuments(docPage, debouncedDocSearch);
  }, [docPage, debouncedDocSearch]);

  // Poll for document status transitions while any document is pending or processing
  useEffect(() => {
    const hasActiveProcessing = documents.some(
      (d) => d.status === "pending" || d.status === "processing",
    );

    if (!hasActiveProcessing) return;

    const interval = setInterval(() => {
      documentApi
        .list({
          page: docPage,
          limit: 20,
          search: debouncedDocSearch || undefined,
        })
        .then((res) => {
          const docs = res.documents || (Array.isArray(res) ? res : []);
          setDocuments(docs);
          if (res.pagination) setDocPagination(res.pagination);
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, docPage, debouncedDocSearch]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext !== "pdf" && ext !== "docx") {
      setUploadError(
        `Unsupported file format .${ext}. Only PDF and .docx are supported.`,
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const filename = selectedFile.name;
    setIsUploading(true);
    setUploadError(null);

    try {
      await documentApi.upload(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocuments();
      toast.success("Document uploaded", `"${filename}" is now processing.`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to upload document";
      setUploadError(msg);
      toast.error("Upload failed", msg);
    } finally {
      setIsUploading(false);
    }
  };

  const openReplaceModal = (doc: DocumentItem) => {
    setTargetDoc(doc);
    setReplaceFile(null);
    setUploadError(null);
    setIsReplaceModalOpen(true);
  };

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDoc || !replaceFile) return;

    const docName = targetDoc.filename;
    setIsReplacing(true);
    try {
      await documentApi.replace(targetDoc.id, replaceFile);
      setIsReplaceModalOpen(false);
      setTargetDoc(null);
      setReplaceFile(null);
      await fetchDocuments();
      toast.success(
        "Document replaced",
        `"${docName}" replaced and queued for reprocessing.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to replace document";
      setUploadError(msg);
      toast.error("Replacement failed", msg);
    } finally {
      setIsReplacing(false);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (
      !confirm(
        `Are you sure you want to delete "${doc.filename}"? Associated knowledge chunks will be deleted.`,
      )
    ) {
      return;
    }

    try {
      await documentApi.delete(doc.id);
      await fetchDocuments();
      toast.success(
        "Document deleted",
        `"${doc.filename}" and its vector chunks were removed.`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete document";
      setError(msg);
      toast.error("Delete failed", msg);
    }
  };

  const handleTestRetrieval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const res = await documentApi.retrieve(searchQuery.trim(), 5);
      setRetrievedChunks(res.chunks);
    } catch (err: unknown) {
      setSearchError(
        err instanceof Error ? err.message : "Retrieval query failed",
      );
      setRetrievedChunks([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      return <FilePdf size={20} className="text-red-400 shrink-0" />;
    }
    return <FileDoc size={20} className="text-sky-400 shrink-0" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#f7f8f8] m-0">
            Knowledge Base & Documents
          </h1>
          <p className="text-sm text-[#8a8f98] mt-1">
            Upload company policies and manuals to ground the RAG onboarding
            assistant. Only PDF and .docx files are accepted.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowsClockwise size={14} />}
          onClick={() => fetchDocuments()}
          isLoading={isLoading}
        >
          Refresh Status
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Upload Zone Card */}
      <Card className="p-6">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-white tracking-tight m-0">
                Upload New Knowledge Document
              </h2>
              <p className="text-xs text-[#8a8f98] mt-0.5">
                Processed asynchronously: text extraction → recursive chunking →
                vector embeddings.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="doc-upload-input"
              />
              <label htmlFor="doc-upload-input">
                <Button
                  type="button"
                  variant="utility"
                  size="sm"
                  icon={<UploadSimple size={14} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? "Change File" : "Select PDF or .docx"}
                </Button>
              </label>

              {selectedFile && (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUploading}
                >
                  Upload & Process
                </Button>
              )}
            </div>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14161a] border border-white/[0.08] text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                {getFileIcon(selectedFile.name)}
                <span className="font-medium text-white truncate">
                  {selectedFile.name}
                </span>
                <span className="text-[#8a8f98] text-[11px] shrink-0 font-mono">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <span className="text-[11px] text-white/80 font-medium shrink-0">
                Ready to upload
              </span>
            </div>
          )}

          {uploadError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {uploadError}
            </div>
          )}
        </form>
      </Card>

      {/* Documents List Card */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3.5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f1013]">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-white/80" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] m-0">
              Knowledge Base Repository ({docPagination.total})
            </h3>
          </div>

          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#8a8f98]">
              <MagnifyingGlass size={13} />
            </div>
            <input
              type="text"
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              placeholder="Search filename..."
              className="w-full pl-8 pr-7 py-1 text-xs bg-[#14161a] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] placeholder-[#565964] focus:outline-none transition-colors"
            />
            {docSearch && (
              <button
                type="button"
                onClick={() => setDocSearch("")}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-[#8a8f98] hover:text-white"
                title="Clear search"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-[#8a8f98]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-xs text-[#a0a6b5]">
                Loading documents...
              </span>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText size={32} className="text-[#5a5e6b] mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white mb-1">
              No Documents Found
            </h4>
            <p className="text-xs text-[#8a8f98] max-w-sm mx-auto">
              {docSearch
                ? `No documents matching "${docSearch}".`
                : "Upload company leave policies, IT setup guides, or manuals above to populate the knowledge base."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f7f8f8]">
              <thead className="bg-[#14161a] text-[#8a8f98] border-b border-white/[0.06] uppercase font-medium text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Chunks</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {documents.map((doc) => {
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-[#14161a]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(doc.filename)}
                          <div className="overflow-hidden">
                            <div className="font-medium text-white truncate max-w-xs sm:max-w-md">
                              {doc.filename}
                            </div>
                            {doc.failureReason && (
                              <div className="text-[11px] text-red-400 mt-0.5 truncate max-w-xs">
                                {doc.failureReason}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {doc.status === "ready" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle size={12} weight="fill" />
                            <span>Ready</span>
                          </span>
                        )}
                        {doc.status === "processing" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Clock size={12} className="animate-spin" />
                            <span>Processing</span>
                          </span>
                        )}
                        {doc.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock size={12} />
                            <span>Pending</span>
                          </span>
                        )}
                        {doc.status === "failed" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <WarningCircle size={12} weight="fill" />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#d0d6e0]">
                        {doc.chunkCount ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {new Date(doc.createdAt).toLocaleDateString()}{" "}
                        {new Date(doc.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ArrowsClockwise size={14} />}
                            onClick={() => openReplaceModal(doc)}
                            title="Replace / re-upload file"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:text-red-400"
                            icon={<Trash size={14} />}
                            onClick={() => handleDelete(doc)}
                            title="Delete document"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={docPage}
          totalPages={docPagination.totalPages}
          totalItems={docPagination.total}
          pageSize={docPagination.limit}
          onPageChange={(newPage) => setDocPage(newPage)}
        />
      </Card>

      {/* Retrieval Test Sandbox (Phase 3 Core Acceptance Tool) */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkle size={16} weight="fill" className="text-indigo-400" />
                <h3 className="text-sm font-medium text-white tracking-tight m-0">
                  Retrieval Verification Sandbox (No LLM)
                </h3>
              </div>
              <p className="text-xs text-[#8a8f98] mt-1">
                Directly validates vector similarity retrieval against stored
                chunks in PostgreSQL. Proves retrieval quality before generation
                is added.
              </p>
            </div>
            <Badge variant="white">Phase 3 Verification</Badge>
          </div>

          <form onSubmit={handleTestRetrieval} className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Ask a question (e.g. 'how do I apply for leave', 'who approves expenses')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<MagnifyingGlass size={15} />}
              isLoading={isSearching}
            >
              Test Query
            </Button>
          </form>

          {searchError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {searchError}
            </div>
          )}

          {hasSearched && !isSearching && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-[#8a8f98]">
                <span>
                  Retrieved <strong>{retrievedChunks.length}</strong> most
                  similar chunks for:{" "}
                  <span className="text-white font-medium">
                    "{searchQuery}"
                  </span>
                </span>
                <span className="text-[11px] font-mono">
                  Ranked by cosine similarity
                </span>
              </div>

              {retrievedChunks.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#14161a] border border-white/[0.06] text-xs text-[#8a8f98] text-center">
                  No similar chunks found. Ensure documents have reached status
                  "Ready".
                </div>
              ) : (
                <div className="space-y-2.5">
                  {retrievedChunks.map((chunk, idx) => {
                    const scorePercent = (chunk.similarity * 100).toFixed(1);
                    return (
                      <div
                        key={chunk.id || idx}
                        className="p-3.5 rounded-lg bg-[#14161a] border border-white/[0.06] hover:border-white/[0.12] transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-white/[0.08] text-white flex items-center justify-center font-mono text-[10px] font-bold">
                              #{idx + 1}
                            </span>
                            <span className="text-white/90 font-medium">
                              {chunk.documentFilename}
                            </span>
                            <span className="text-[#8a8f98] text-[11px] font-mono">
                              (Chunk {chunk.chunkIndex + 1})
                            </span>
                          </div>
                          <span className="text-[11px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {scorePercent}% similarity
                          </span>
                        </div>

                        <div className="p-2.5 rounded bg-[#0a0b0e] border border-white/[0.04] text-xs text-[#d0d6e0] leading-relaxed font-sans select-text">
                          {chunk.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Replace Document Modal */}
      <Modal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        title={`Replace Document: ${targetDoc?.filename}`}
        maxWidth="md"
      >
        <form onSubmit={handleReplace} className="space-y-4">
          <p className="text-sm text-[#8a8f98] mb-2">
            Replacing this document will cascade-delete all existing chunks from
            the database and re-chunk the new file.
          </p>

          <div className="flex flex-col gap-2">
            <input
              ref={replaceInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setReplaceFile(e.target.files[0]);
                }
              }}
              className="hidden"
              id="replace-file-input"
            />
            <Button
              type="button"
              variant="utility"
              size="md"
              icon={<UploadSimple size={15} />}
              onClick={() => replaceInputRef.current?.click()}
            >
              {replaceFile
                ? replaceFile.name
                : "Select Replacement PDF or .docx"}
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsReplaceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!replaceFile}
              isLoading={isReplacing}
            >
              Confirm Replacement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
