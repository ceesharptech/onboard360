import React, { useState, useEffect, useMemo } from "react";
import {
  Video,
  BookOpen,
  Plus,
  Trash,
  PencilSimple,
  MagnifyingGlass,
  Play,
  ArrowSquareOut,
  WarningCircle,
  Sparkle,
  CheckCircle,
  Eye,
  Code,
} from "@phosphor-icons/react";
import { trainingApi } from "../../api/endpoints";
import type {
  TrainingEntry,
  CreateTrainingEntryInput,
  UpdateTrainingEntryInput,
  PaginationMeta,
} from "../../api/endpoints";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { Pagination } from "../../components/common/Pagination";
import { MarkdownRenderer } from "../../components/common/MarkdownRenderer";

// Client-side helper to validate and extract YouTube video ID for live preview
export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const v = parsed.searchParams.get("v");
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      }
      const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
      const shortsMatch = parsed.pathname.match(
        /^\/shorts\/([a-zA-Z0-9_-]{11})/,
      );
      if (shortsMatch) return shortsMatch[1];
    }

    if (hostname === "youtu.be") {
      const shortMatch = parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})/);
      if (shortMatch) return shortMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export const TrainingLibrary: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isHrAdmin = user?.role === "hr_admin";

  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter & Pagination
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "guide">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Modals
  const [viewingEntry, setViewingEntry] = useState<TrainingEntry | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TrainingEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<TrainingEntry | null>(
    null,
  );

  // Create / Edit Form State
  const [formData, setFormData] = useState<{
    type: "video" | "guide";
    title: string;
    description: string;
    youtubeUrl: string;
    guideContent: string;
  }>({
    type: "video",
    title: "",
    description: "",
    youtubeUrl: "",
    guideContent: "",
  });
  const [guideEditorTab, setGuideEditorTab] = useState<"write" | "preview">(
    "write",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load training entries
  const loadEntries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await trainingApi.list({
        page,
        limit: 12,
        search: debouncedSearch || undefined,
        contentType: typeFilter === "all" ? undefined : typeFilter,
      });

      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setEntries(list);

      if ((res as any)?.pagination) {
        setPagination((res as any).pagination);
      } else {
        setPagination({
          total: list.length,
          page,
          limit: 12,
          totalPages: Math.max(1, Math.ceil(list.length / 12)),
          hasNextPage: false,
          hasPrevPage: page > 1,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load training entries");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [page, debouncedSearch, typeFilter]);

  // Detected YouTube ID for live preview in form
  const previewYouTubeId = useMemo(() => {
    if (formData.type !== "video" || !formData.youtubeUrl) return null;
    return extractYouTubeId(formData.youtubeUrl);
  }, [formData.type, formData.youtubeUrl]);

  // Handle open create modal
  const handleOpenCreate = () => {
    setFormData({
      type: "video",
      title: "",
      description: "",
      youtubeUrl: "",
      guideContent: "",
    });
    setFormError(null);
    setGuideEditorTab("write");
    setIsCreateModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (entry: TrainingEntry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFormData({
      type: entry.type,
      title: entry.title,
      description: entry.description || "",
      youtubeUrl: entry.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${entry.youtubeVideoId}`
        : "",
      guideContent: entry.guideContent || "",
    });
    setFormError(null);
    setGuideEditorTab("write");
    setEditingEntry(entry);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError("Title is required");
      return;
    }

    if (!formData.description.trim()) {
      setFormError("Description is required");
      return;
    }

    if (formData.type === "video") {
      if (!formData.youtubeUrl.trim()) {
        setFormError("YouTube URL is required");
        return;
      }
      if (!previewYouTubeId) {
        setFormError(
          "Please provide a valid YouTube link (e.g. https://www.youtube.com/watch?v=...)",
        );
        return;
      }
    } else {
      if (
        !formData.guideContent.trim() ||
        formData.guideContent.trim().length < 10
      ) {
        setFormError("Guide content must be at least 10 characters");
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: CreateTrainingEntryInput = {
        contentType: formData.type,
        type: formData.type,
        title: formData.title.trim(),
        description: formData.description.trim(),
        ...(formData.type === "video"
          ? { youtubeUrl: formData.youtubeUrl.trim() }
          : { guideContent: formData.guideContent.trim() }),
      };

      await trainingApi.create(payload);
      toast.success("Training entry created successfully");
      setIsCreateModalOpen(false);
      loadEntries();
    } catch (err: any) {
      setFormError(err.message || "Failed to create training entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    if (!formData.title.trim()) {
      setFormError("Title is required");
      return;
    }

    if (!formData.description.trim()) {
      setFormError("Description is required");
      return;
    }

    if (editingEntry.type === "video") {
      if (formData.youtubeUrl && !previewYouTubeId) {
        setFormError("Please provide a valid YouTube link");
        return;
      }
    } else {
      if (formData.guideContent && formData.guideContent.trim().length < 10) {
        setFormError("Guide content must be at least 10 characters");
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: UpdateTrainingEntryInput = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        contentType: editingEntry.type,
        type: editingEntry.type,
        ...(editingEntry.type === "video"
          ? { youtubeUrl: formData.youtubeUrl.trim() || undefined }
          : { guideContent: formData.guideContent.trim() || undefined }),
      };

      const updated = await trainingApi.update(editingEntry.id, payload);
      toast.success("Training entry updated successfully");
      setEditingEntry(null);
      // Update local state if currently viewing this entry
      if (viewingEntry?.id === editingEntry.id) {
        setViewingEntry(updated);
      }
      loadEntries();
    } catch (err: any) {
      setFormError(err.message || "Failed to update training entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete
  const handleDeleteSubmit = async () => {
    if (!deletingEntry) return;
    setIsSubmitting(true);
    try {
      await trainingApi.delete(deletingEntry.id);
      toast.success("Training entry deleted");
      if (viewingEntry?.id === deletingEntry.id) {
        setViewingEntry(null);
      }
      setDeletingEntry(null);
      loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete training entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto text-[#f7f8f8] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Video size={18} weight="duotone" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-[#f7f8f8]">
                Training & Guides
              </h1>
            </div>
            <p className="mt-1.5 text-xs text-[#8a8f98]">
              Curated onboarding videos, walkthroughs, and reference guides
              available company-wide.
            </p>
          </div>

          {isHrAdmin && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={16} weight="bold" />}
              onClick={handleOpenCreate}
            >
              Add Training Entry
            </Button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <MagnifyingGlass
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5e6b]"
            />
            <input
              type="text"
              placeholder="Search training by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setTypeFilter("all");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                typeFilter === "all"
                  ? "bg-white/[0.1] text-white shadow-2xs"
                  : "text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04]"
              }`}
            >
              All Content
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("video");
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                typeFilter === "video"
                  ? "bg-white/[0.1] text-white shadow-2xs"
                  : "text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04]"
              }`}
            >
              <Video size={14} />
              Videos
            </button>
            <button
              type="button"
              onClick={() => {
                setTypeFilter("guide");
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                typeFilter === "guide"
                  ? "bg-white/[0.1] text-white shadow-2xs"
                  : "text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04]"
              }`}
            >
              <BookOpen size={14} />
              Guides
            </button>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse p-4 flex flex-col justify-between"
              >
                <div className="w-full h-32 bg-white/[0.04] rounded-lg" />
                <div className="space-y-2 mt-4">
                  <div className="w-3/4 h-4 bg-white/[0.04] rounded" />
                  <div className="w-1/2 h-3 bg-white/[0.03] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-red-500/5 border border-red-500/10 rounded-xl">
            <WarningCircle size={28} className="mx-auto text-red-400 mb-2" />
            <p className="text-sm text-red-400">{error}</p>
            <Button
              variant="utility"
              size="sm"
              onClick={loadEntries}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.01] border border-white/[0.04] rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-[#8a8f98] mb-3">
              {typeFilter === "video" ? (
                <Video size={24} />
              ) : typeFilter === "guide" ? (
                <BookOpen size={24} />
              ) : (
                <Sparkle size={24} />
              )}
            </div>
            <h3 className="text-sm font-semibold text-[#f7f8f8]">
              {search
                ? "No training entries match your search"
                : "No training entries found"}
            </h3>
            <p className="text-xs text-[#8a8f98] max-w-sm mx-auto mt-1">
              {search
                ? `No results for "${search}". Try checking for typos or searching a different term.`
                : isHrAdmin
                  ? "Start building the onboarding catalog by adding training videos and written guides."
                  : "Your company has not published any training entries yet. Check back soon!"}
            </p>
            {isHrAdmin && !search && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={15} />}
                onClick={handleOpenCreate}
                className="mt-4"
              >
                Create First Entry
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry) => (
                <Card
                  key={entry.id}
                  className="group relative flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-200 hover:border-white/[0.2] hover:bg-white/[0.04] p-0"
                  onClick={() => setViewingEntry(entry)}
                >
                  {/* Top Media / Thumbnail Area */}
                  {entry.type === "video" ? (
                    <div className="relative w-full aspect-video bg-black/60 overflow-hidden border-b border-white/[0.06]">
                      {entry.youtubeVideoId ? (
                        <img
                          src={`https://img.youtube.com/vi/${entry.youtubeVideoId}/hqdefault.jpg`}
                          alt={entry.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-950/20">
                          <Video size={36} className="text-indigo-400/50" />
                        </div>
                      )}
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110">
                          <Play size={20} weight="fill" className="ml-0.5" />
                        </div>
                      </div>
                      {/* Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <Badge variant="purple" size="sm">
                          <Video size={11} className="mr-1 inline" />
                          Video
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-36 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border-b border-white/[0.06] p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <Badge variant="gray" size="sm">
                          <BookOpen size={11} className="mr-1 inline" />
                          Written Guide
                        </Badge>
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[#8a8f98]">
                          <BookOpen size={18} />
                        </div>
                      </div>
                      <div className="text-[11px] text-[#8a8f98] font-mono flex items-center gap-1">
                        <span>Markdown Document</span>
                      </div>
                    </div>
                  )}

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#f7f8f8] group-hover:text-white line-clamp-1">
                        {entry.title}
                      </h3>
                      {entry.description ? (
                        <p className="text-xs text-[#8a8f98] mt-1.5 line-clamp-2 leading-relaxed">
                          {entry.description}
                        </p>
                      ) : (
                        <p className="text-xs text-[#5a5e6b] italic mt-1.5">
                          No description provided
                        </p>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-[#5a5e6b]">
                      <span className="truncate max-w-[140px]">
                        {new Date(entry.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>

                      {/* Admin Controls */}
                      {isHrAdmin && (
                        <div
                          className="flex items-center gap-1 opacity-80 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Edit Entry"
                            onClick={(e) => handleOpenEdit(entry, e)}
                            className="p-1 rounded-md text-[#8a8f98] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete Entry"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingEntry(entry);
                            }}
                            className="p-1 rounded-md text-[#8a8f98] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.total > 0 && (
              <Pagination
                currentPage={page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                pageSize={pagination.limit}
                onPageChange={setPage}
                className="mt-6"
              />
            )}
          </>
        )}
      </div>

      {/* VIEW ENTRY MODAL */}
      <Modal
        isOpen={!!viewingEntry}
        onClose={() => setViewingEntry(null)}
        title={
          <div className="flex items-center gap-2">
            {viewingEntry?.type === "video" ? (
              <Badge variant="purple" size="sm">
                <Video size={12} className="mr-1 inline" /> Video
              </Badge>
            ) : (
              <Badge variant="gray" size="sm">
                <BookOpen size={12} className="mr-1 inline" /> Written Guide
              </Badge>
            )}
            <span className="truncate max-w-md">{viewingEntry?.title}</span>
          </div>
        }
        maxWidth={viewingEntry?.type === "video" ? "xl" : "lg"}
      >
        {viewingEntry && (
          <div className="space-y-4">
            {/* Video Player */}
            {viewingEntry.type === "video" && (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/[0.08] shadow-2xl">
                <iframe
                  src={
                    viewingEntry.embedUrl ||
                    (viewingEntry.youtubeVideoId
                      ? `https://www.youtube.com/embed/${viewingEntry.youtubeVideoId}`
                      : "")
                  }
                  title={viewingEntry.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}

            {/* Entry Header Info */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-semibold text-[#f7f8f8]">
                  {viewingEntry.title}
                </h2>
                {viewingEntry.youtubeVideoId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${viewingEntry.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#8a8f98] hover:text-white transition-colors shrink-0"
                  >
                    <span>Watch on YouTube</span>
                    <ArrowSquareOut size={13} />
                  </a>
                )}
              </div>

              {viewingEntry.description && (
                <p className="text-xs text-[#8a8f98] mt-2 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                  {viewingEntry.description}
                </p>
              )}
            </div>

            {/* Guide Content Markdown Reader */}
            {viewingEntry.type === "guide" && (
              <div className="border-t border-white/[0.06] pt-4 mt-2">
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                  <MarkdownRenderer content={viewingEntry.guideContent || ""} />
                </div>
              </div>
            )}

            {/* Footer Metadata */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#5a5e6b]">
              <div>
                <span>
                  Added on{" "}
                  {new Date(viewingEntry.createdAt).toLocaleDateString()}
                </span>
                {viewingEntry.creator?.email && (
                  <span className="ml-2">by {viewingEntry.creator.email}</span>
                )}
              </div>
              <Button
                variant="utility"
                size="sm"
                onClick={() => setViewingEntry(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE ENTRY MODAL (HR Admin Only) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !isSubmitting && setIsCreateModalOpen(false)}
        title="Add Training Entry"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
              <WarningCircle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-medium text-[#8a8f98] mb-1.5">
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "video" })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  formData.type === "video"
                    ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300"
                    : "bg-white/[0.02] border-white/[0.06] text-[#8a8f98] hover:text-white"
                }`}
              >
                <Video size={16} />
                YouTube Video
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: "guide" })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  formData.type === "guide"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                    : "bg-white/[0.02] border-white/[0.06] text-[#8a8f98] hover:text-white"
                }`}
              >
                <BookOpen size={16} />
                Written Guide
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-medium text-[#8a8f98] mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Engineering Onboarding & Git Workflow"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors"
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-xs font-medium text-[#8a8f98] mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              required
              maxLength={1000}
              placeholder="Brief summary of what new hires will learn..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors resize-none"
            />
          </div>

          {/* Video Specific: YouTube URL & Live Preview */}
          {formData.type === "video" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#8a8f98] mb-1">
                  YouTube Video Link <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={formData.youtubeUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, youtubeUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors"
                />
              </div>

              {/* Live Preview / Status */}
              {formData.youtubeUrl && (
                <div className="rounded-lg border border-white/[0.08] bg-black/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#8a8f98]">
                      Embed Preview:
                    </span>
                    {previewYouTubeId ? (
                      <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                        <CheckCircle size={14} weight="fill" /> Valid YouTube
                        Video ({previewYouTubeId})
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 text-[11px]">
                        <WarningCircle size={14} weight="fill" /> Invalid
                        YouTube link
                      </span>
                    )}
                  </div>

                  {previewYouTubeId && (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black border border-white/[0.06]">
                      <iframe
                        src={`https://www.youtube.com/embed/${previewYouTubeId}`}
                        title="Live Preview"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Guide Specific: Markdown Editor with Preview */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#8a8f98]">
                  Guide Content (Markdown){" "}
                  <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setGuideEditorTab("write")}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      guideEditorTab === "write"
                        ? "bg-white/[0.1] text-white"
                        : "text-[#8a8f98] hover:text-white"
                    }`}
                  >
                    <Code size={12} />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideEditorTab("preview")}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      guideEditorTab === "preview"
                        ? "bg-white/[0.1] text-white"
                        : "text-[#8a8f98] hover:text-white"
                    }`}
                  >
                    <Eye size={12} />
                    Preview
                  </button>
                </div>
              </div>

              {guideEditorTab === "write" ? (
                <textarea
                  rows={8}
                  required
                  placeholder="Write your onboarding guide here in Markdown format...
# Getting Started
- Step 1: Set up your workspace
- Step 2: Join the team Slack
"
                  value={formData.guideContent}
                  onChange={(e) =>
                    setFormData({ ...formData, guideContent: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs font-mono text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors resize-y"
                />
              ) : (
                <div className="min-h-[190px] max-h-[300px] overflow-y-auto p-3 bg-black/40 border border-white/[0.08] rounded-lg">
                  {formData.guideContent.trim() ? (
                    <MarkdownRenderer content={formData.guideContent} />
                  ) : (
                    <span className="text-xs text-[#5a5e6b] italic">
                      Nothing to preview yet. Switch to "Write" to add content.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="utility"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Create Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT ENTRY MODAL (HR Admin Only) */}
      <Modal
        isOpen={!!editingEntry}
        onClose={() => !isSubmitting && setEditingEntry(null)}
        title={`Edit ${editingEntry?.type === "video" ? "Video" : "Guide"} Entry`}
        maxWidth="lg"
      >
        {editingEntry && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <WarningCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Type indicator (Immutable) */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8a8f98]">Type:</span>
              <Badge
                variant={editingEntry.type === "video" ? "purple" : "gray"}
                size="sm"
              >
                {editingEntry.type === "video"
                  ? "YouTube Video"
                  : "Written Guide"}
              </Badge>
              <span className="text-[11px] text-[#5a5e6b]">
                (Type cannot be changed)
              </span>
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-xs font-medium text-[#8a8f98] mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors"
              />
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-xs font-medium text-[#8a8f98] mb-1">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                maxLength={1000}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors resize-none"
              />
            </div>

            {/* Video or Guide Specific Fields */}
            {editingEntry.type === "video" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#8a8f98] mb-1">
                    YouTube Video Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={formData.youtubeUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, youtubeUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors"
                  />
                </div>

                {formData.youtubeUrl && (
                  <div className="rounded-lg border border-white/[0.08] bg-black/40 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#8a8f98]">
                        Embed Preview:
                      </span>
                      {previewYouTubeId ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                          <CheckCircle size={14} weight="fill" /> Valid (
                          {previewYouTubeId})
                        </span>
                      ) : (
                        <span className="text-red-400 flex items-center gap-1 text-[11px]">
                          <WarningCircle size={14} weight="fill" /> Invalid
                          YouTube link
                        </span>
                      )}
                    </div>

                    {previewYouTubeId && (
                      <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black border border-white/[0.06]">
                        <iframe
                          src={`https://www.youtube.com/embed/${previewYouTubeId}`}
                          title="Preview"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#8a8f98]">
                    Guide Content (Markdown)
                  </label>
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setGuideEditorTab("write")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        guideEditorTab === "write"
                          ? "bg-white/[0.1] text-white"
                          : "text-[#8a8f98] hover:text-white"
                      }`}
                    >
                      <Code size={12} /> Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuideEditorTab("preview")}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        guideEditorTab === "preview"
                          ? "bg-white/[0.1] text-white"
                          : "text-[#8a8f98] hover:text-white"
                      }`}
                    >
                      <Eye size={12} /> Preview
                    </button>
                  </div>
                </div>

                {guideEditorTab === "write" ? (
                  <textarea
                    rows={8}
                    value={formData.guideContent}
                    onChange={(e) =>
                      setFormData({ ...formData, guideContent: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs font-mono text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-hidden focus:border-white/[0.2] transition-colors resize-y"
                  />
                ) : (
                  <div className="min-h-[190px] max-h-[300px] overflow-y-auto p-3 bg-black/40 border border-white/[0.08] rounded-lg">
                    <MarkdownRenderer content={formData.guideContent} />
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="utility"
                size="sm"
                onClick={() => setEditingEntry(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* DELETE ENTRY CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deletingEntry}
        onClose={() => !isSubmitting && setDeletingEntry(null)}
        title="Delete Training Entry"
        maxWidth="sm"
      >
        {deletingEntry && (
          <div className="space-y-4">
            <p className="text-xs text-[#8a8f98] leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-white font-semibold">
                "{deletingEntry.title}"
              </strong>
              ? This action cannot be undone and will remove it from all
              employee dashboards.
            </p>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="utility"
                size="sm"
                onClick={() => setDeletingEntry(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleDeleteSubmit}
              >
                Delete Entry
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
