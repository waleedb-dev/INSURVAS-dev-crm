"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Search, Plus, Edit, Trash2, ChevronRight, Play, FileText, X, Upload, ChevronLeft, Check, Maximize2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductGuide {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  bullets: string[];
  video_url: string | null;
  screenshots: string[];
  category: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

function StyledSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select..."
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(val) => onValueChange(val || "")}>
      <SelectTrigger
        style={{
          width: "100%",
          height: 38,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          backgroundColor: T.cardBg,
          color: value && value !== "All" ? T.textDark : T.textMuted,
          fontSize: 13,
          fontWeight: 500,
          paddingLeft: 14,
          paddingRight: 12,
          transition: "all 0.15s ease-in-out",
          position: "relative",
          zIndex: 1,
        }}
        className="hover:border-[#233217] focus:border-[#233217] focus:ring-2 focus:ring-[#233217]/20"
      >
        <SelectValue placeholder={placeholder}>
          {value && value !== "All"
            ? options.find(o => o.value === value)?.label || value
            : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          backgroundColor: T.cardBg,
          padding: 6,
          maxHeight: 300,
          zIndex: 99999,
        }}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            style={{
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 400,
              color: T.textDark,
              cursor: "pointer",
              transition: "all 0.1s ease-in-out",
            }}
            className="hover:bg-[#DCEBDC] hover:text-[#233217] focus:bg-[#DCEBDC] focus:text-[#233217] data-[state=checked]:bg-[#233217] data-[state=checked]:text-white data-[state=checked]:font-semibold"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LoadingSpinner({ size = 40, label = "Loading..." }: { size?: number; label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${T.border}`,
          borderTopColor: "#233217",
          animation: "spin 0.8s linear infinite",
        }}
      />
      {label && (
        <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted }}>{label}</span>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = percent * videoRef.current.duration;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.volume = percent;
      setVolume(percent);
      setIsMuted(percent === 0);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        backgroundColor: "#000",
        borderRadius: 12,
        overflow: "hidden",
        width: "100%",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        style={{ width: "100%", display: "block", maxHeight: 500 }}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Play button overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundColor: "rgba(35, 50, 23, 0.9)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease-in-out",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)"; }}
        >
          <Play size={32} color="#fff" fill="#fff" />
        </button>
      )}

      {/* Controls */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
        padding: "40px 16px 16px",
        opacity: showControls ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}>
        {/* Progress bar */}
        <div
          onClick={handleSeek}
          style={{
            width: "100%",
            height: 4,
            backgroundColor: "rgba(255,255,255,0.3)",
            borderRadius: 2,
            cursor: "pointer",
            marginBottom: 12,
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: "#233217",
              borderRadius: 2,
              position: "relative",
            }}
          >
            <div style={{
              position: "absolute",
              right: -6,
              top: -4,
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#fff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }} />
          </div>
        </div>

        {/* Control buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={togglePlay}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <Play size={20} color="#fff" fill="#fff" />
              )}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={toggleMute}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isMuted || volume === 0 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                )}
              </button>
              <div
                onClick={handleVolumeChange}
                style={{
                  width: 60,
                  height: 4,
                  backgroundColor: "rgba(255,255,255,0.3)",
                  borderRadius: 2,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${(isMuted ? 0 : volume) * 100}%`,
                    height: "100%",
                    backgroundColor: "#fff",
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>

            <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Maximize2 size={18} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Main image */}
        <div
          onClick={() => setShowLightbox(true)}
          style={{
            width: "100%",
            height: 300,
            borderRadius: 12,
            overflow: "hidden",
            cursor: "pointer",
            position: "relative",
            backgroundColor: T.pageBg,
          }}
        >
          <img
            src={images[selectedIndex]}
            alt={`${title} - Screenshot ${selectedIndex + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0)"; }}
          >
            <Maximize2 size={32} color="#fff" style={{ opacity: 0, transition: "opacity 0.2s" }} />
          </div>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                style={{
                  width: 64,
                  height: 48,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: selectedIndex === idx ? `2px solid #233217` : `2px solid transparent`,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  opacity: selectedIndex === idx ? 1 : 0.6,
                  transition: "all 0.15s ease",
                }}
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={() => setShowLightbox(false)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
            }}
          >
            <X size={28} color="#fff" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                style={{
                  position: "absolute",
                  left: 20,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: 48,
                  height: 48,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={24} color="#fff" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                style={{
                  position: "absolute",
                  right: 20,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: 48,
                  height: 48,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={24} color="#fff" />
              </button>
            </>
          )}

          <img
            src={images[selectedIndex]}
            alt={`${title} - Full size`}
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />

          <div style={{ position: "absolute", bottom: 20, display: "flex", gap: 8 }}>
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: selectedIndex === idx ? "#fff" : "rgba(255,255,255,0.3)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function ProductGuidePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [guides, setGuides] = useState<ProductGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [view, setView] = useState<"list" | "view" | "edit">("list");
  const [selectedGuide, setSelectedGuide] = useState<ProductGuide | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Edit/Create states
  const [editingGuide, setEditingGuide] = useState<ProductGuide | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBullets, setEditBullets] = useState<string[]>([]);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editScreenshots, setEditScreenshots] = useState<string[]>([]);
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingGuide, setDeletingGuide] = useState<ProductGuide | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // View page scroll state
  const [activeSection, setActiveSection] = useState("video");
  const contentRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(guides.map(g => g.category)));
    return cats.sort();
  }, [guides]);

  const fetchGuides = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_guides")
      .select("*")
      .order("display_order")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching guides:", error);
    } else {
      const mappedGuides: ProductGuide[] = (data ?? []).map((g) => ({
        id: g.id as number,
        title: g.title as string,
        slug: g.slug as string,
        description: g.description as string | null,
        bullets: typeof g.bullets === "string" ? JSON.parse(g.bullets) : (g.bullets || []),
        video_url: g.video_url as string | null,
        screenshots: typeof g.screenshots === "string" ? JSON.parse(g.screenshots) : (g.screenshots || []),
        category: g.category as string,
        display_order: g.display_order as number,
        is_published: g.is_published as boolean,
        created_at: g.created_at as string,
        updated_at: g.updated_at as string,
      }));
      setGuides(mappedGuides);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchGuides();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchGuides]);

  useEffect(() => {
    if (view !== "view") return;
    const handleScroll = () => {
      if (!contentRef.current) return;
      const scrollTop = contentRef.current.scrollTop;
      const sectionElements = contentRef.current.querySelectorAll("[data-section]");
      sectionElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const relativeTop = rect.top - contentRef.current!.getBoundingClientRect().top;
        if (relativeTop - 100 <= scrollTop && relativeTop + rect.height - 100 > scrollTop) {
          setActiveSection(el.getAttribute("data-section") || "");
        }
      });
    };
    const content = contentRef.current;
    if (content) {
      content.addEventListener("scroll", handleScroll);
      return () => content.removeEventListener("scroll", handleScroll);
    }
  }, [view]);

  const filteredGuides = useMemo(() => {
    return guides.filter(g => {
      const matchesSearch = !search || 
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase()) ||
        g.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "All" || g.category === categoryFilter;
      return matchesSearch && matchesCategory && g.is_published;
    });
  }, [guides, search, categoryFilter]);

  const groupedGuides = useMemo(() => {
    const sourceGuides = view === "view" ? filteredGuides : guides;
    const grouped = sourceGuides.reduce((acc, guide) => {
      if (!acc[guide.category]) acc[guide.category] = [];
      acc[guide.category].push(guide);
      return acc;
    }, {} as Record<string, ProductGuide[]>);
    return grouped;
  }, [guides, filteredGuides, view]);

  function openGuide(guide: ProductGuide) {
    setSelectedGuide(guide);
    setView("view");
  }

  function openCreate() {
    setEditingGuide(null);
    setEditTitle("");
    setEditDescription("");
    setEditBullets([]);
    setEditVideoUrl("");
    setEditScreenshots([]);
    setEditCategory("");
    setView("edit");
  }

  function openEdit(guide: ProductGuide) {
    setEditingGuide(guide);
    setEditTitle(guide.title);
    setEditDescription(guide.description || "");
    setEditBullets(guide.bullets || []);
    setEditVideoUrl(guide.video_url || "");
    setEditScreenshots(guide.screenshots || []);
    setEditCategory(guide.category);
    setView("edit");
  }

  async function handleUploadScreenshot(file: File) {
    setUploadingImage(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueName = `${Date.now()}_${crypto.randomUUID()}_${safeName}`;
      const { data, error } = await supabase.storage
        .from('guide-screenshots')
        .upload(`screenshots/${uniqueName}`, file, { upsert: false });

      if (error) {
        console.error("Upload error:", error);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('guide-screenshots')
        .getPublicUrl(data.path);

      setEditScreenshots(prev => [...prev, publicUrlData.publicUrl]);
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploadingImage(false);
  }

  function removeScreenshot(index: number) {
    setEditScreenshots(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!editTitle.trim()) return;
    setSaving(true);

    const payload = {
      title: editTitle.trim(),
      slug: editingGuide?.slug || slugify(editTitle.trim()),
      description: editDescription.trim() || null,
      bullets: editBullets.filter(b => b.trim()),
      video_url: editVideoUrl.trim() || null,
      screenshots: editScreenshots,
      category: editCategory.trim() || "General",
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingGuide) {
      const { error: err } = await supabase
        .from("product_guides")
        .update(payload)
        .eq("id", editingGuide.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("product_guides")
        .insert([payload]);
      error = err;
    }

    setSaving(false);
    if (error) {
      console.error("Error saving guide:", error);
    } else {
      void fetchGuides();
      setView("list");
    }
  }

  function openDeleteModal(guide: ProductGuide) {
    setDeletingGuide(guide);
    setShowDeleteModal(true);
  }

  async function handleDelete() {
    if (!deletingGuide) return;
    setDeletingInProgress(true);

    const { error } = await supabase
      .from("product_guides")
      .delete()
      .eq("id", deletingGuide.id);

    setDeletingInProgress(false);
    if (error) {
      console.error("Error deleting guide:", error);
    } else {
      void fetchGuides();
      setShowDeleteModal(false);
      setDeletingGuide(null);
    }
  }

  function addBullet() {
    setEditBullets([...editBullets, ""]);
  }

  function updateBullet(index: number, value: string) {
    const updated = [...editBullets];
    updated[index] = value;
    setEditBullets(updated);
  }

  function removeBullet(index: number) {
    setEditBullets(editBullets.filter((_, i) => i !== index));
  }

  // Guide View Page
  if (view === "view" && selectedGuide) {
    const currentIndex = filteredGuides.findIndex(g => g.id === selectedGuide.id);
    const prevGuide = currentIndex > 0 ? filteredGuides[currentIndex - 1] : null;
    const nextGuide = currentIndex < filteredGuides.length - 1 ? filteredGuides[currentIndex - 1] : null;

    return (
      <div style={{ animation: "fadeIn 0.3s ease-out", display: "flex", gap: 24, minHeight: "calc(100vh - 200px)" }}>
        {/* Left Sidebar - Guides Card */}
        <div style={{
          width: 300,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Guides List Card with internal scroll */}
          <div style={{
            backgroundColor: T.cardBg,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            height: "calc(100vh - 240px)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Search */}
            <div style={{ padding: "16px", borderBottom: `1px solid ${T.borderLight}` }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
                <input
                  type="text"
                  placeholder="Search guides..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    height: 36,
                    paddingLeft: 32,
                    paddingRight: 12,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: T.textDark,
                    outline: "none",
                    backgroundColor: T.pageBg,
                  }}
                />
              </div>
            </div>

            {/* Scrollable Guides List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              <nav>
                {Object.entries(groupedGuides).map(([category, categoryGuides]) => (
                  <div key={category} style={{ marginBottom: 12 }}>
                    <h3 style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, margin: "0 0 6px 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{category}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {categoryGuides.map((guide) => (
                        <button
                          key={guide.id}
                          onClick={() => openGuide(guide)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "none",
                            backgroundColor: selectedGuide.id === guide.id ? "#233217" : "transparent",
                            color: selectedGuide.id === guide.id ? "#fff" : T.textMid,
                            fontSize: 13,
                            fontWeight: selectedGuide.id === guide.id ? 600 : 500,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.15s ease-in-out",
                            width: "100%",
                          }}
                          onMouseEnter={(e) => {
                            if (selectedGuide.id !== guide.id) {
                              e.currentTarget.style.backgroundColor = T.rowBg;
                              e.currentTarget.style.color = "#233217";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedGuide.id !== guide.id) {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.color = T.textMid;
                            }
                          }}
                        >
                          {guide.video_url && <Play size={12} style={{ flexShrink: 0, opacity: selectedGuide.id === guide.id ? 1 : 0.6 }} />}
                          {guide.screenshots && guide.screenshots.length > 0 && <Maximize2 size={12} style={{ flexShrink: 0, opacity: selectedGuide.id === guide.id ? 1 : 0.6 }} />}
                          {!guide.video_url && (!guide.screenshots || guide.screenshots.length === 0) && <FileText size={12} style={{ flexShrink: 0, opacity: selectedGuide.id === guide.id ? 1 : 0.6 }} />}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{guide.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            paddingRight: 8,
            paddingTop: 8,
            height: "calc(100vh - 200px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Breadcrumbs */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <button
              onClick={() => setView("list")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                color: T.textMuted,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                transition: "all 0.15s ease-in-out",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#233217";
                e.currentTarget.style.backgroundColor = T.rowBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = T.textMuted;
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Product Guides
            </button>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#233217" }}>{selectedGuide.title}</span>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#233217", margin: 0 }}>
            {selectedGuide.title}
          </h1>

          {/* Two Column Layout: Video + Overview/Key Points */}
          <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
            {/* Left: Video Card */}
            {selectedGuide.video_url && (
              <div style={{
                width: 340,
                flexShrink: 0,
                backgroundColor: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.borderLight}` }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#233217", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <Play size={16} /> Video Tutorial
                  </h3>
                </div>
                <VideoPlayer src={selectedGuide.video_url} />
              </div>
            )}

            {/* Right: Overview + Key Points with internal scroll */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 4px",
            }}>
              {/* Overview Section */}
              {selectedGuide.description && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#233217", margin: "0 0 12px 0" }}>Overview</h3>
                  <p style={{ fontSize: 15, color: T.textDark, lineHeight: 1.7, margin: 0 }}>
                    {selectedGuide.description}
                  </p>
                </div>
              )}

              {/* Key Points Section */}
              {selectedGuide.bullets && selectedGuide.bullets.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "#233217", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#233217", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={16} color="#fff" strokeWidth={3} />
                    </div>
                    Key Points
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {selectedGuide.bullets.map((bullet, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 16,
                          padding: "14px 0",
                          borderBottom: index < selectedGuide.bullets.length - 1 ? `1px solid ${T.borderLight}` : "none",
                        }}
                      >
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          backgroundColor: "#DCEBDC",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#233217" }}>{index + 1}</span>
                        </div>
                        <span style={{ fontSize: 14, color: T.textDark, lineHeight: 1.6 }}>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Edit/Create Page
  if (view === "edit") {
    return (
      <div style={{ animation: "fadeIn 0.3s ease-out" }}>
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => setView("list")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              color: T.textMuted,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 12,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Guides
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#233217", margin: 0 }}>
            {editingGuide ? "Edit Guide" : "Create New Guide"}
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 800 }}>
          {/* Basic Information */}
          <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#233217", margin: "0 0 20px 0" }}>Basic Information</h2>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter guide title..."
                style={{ width: "100%", height: 44, padding: "0 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.textDark, fontWeight: 500, outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>Category</label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g., Getting Started, Daily Deal Flow..."
                style={{ width: "100%", height: 44, padding: "0 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.textDark, fontWeight: 500, outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter a brief description..."
                rows={3}
                style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.textDark, fontWeight: 500, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Video Section */}
          <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#233217", margin: "0 0 20px 0" }}>Video Tutorial</h2>
            
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.3px" }}>Video URL</label>
              <input
                type="text"
                value={editVideoUrl}
                onChange={(e) => setEditVideoUrl(e.target.value)}
                placeholder="Paste video URL (MP4, WebM)..."
                style={{ width: "100%", height: 44, padding: "0 14px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.textDark, fontWeight: 500, outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
              />
              <p style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>Enter a direct link to a video file (MP4, WebM)</p>
            </div>
          </div>

          {/* Screenshots Section */}
          <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#233217", margin: "0 0 20px 0" }}>Screenshots / Images</h2>
            
            {/* Upload area */}
            <div style={{
              border: `2px dashed ${T.border}`,
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              marginBottom: 16,
              backgroundColor: T.pageBg,
            }}>
              <input
                type="file"
                accept="image/*"
                multiple
                id="screenshot-upload"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  for (const file of files) {
                    await handleUploadScreenshot(file);
                  }
                  e.target.value = "";
                }}
              />
              <label
                htmlFor="screenshot-upload"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                }}
              >
                {uploadingImage ? (
                  <LoadingSpinner size={32} label="Uploading..." />
                ) : (
                  <>
                    <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: T.blueFaint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Upload size={24} color={T.blue} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.textDark, margin: "0 0 4px 0" }}>Click to upload screenshots</p>
                      <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>PNG, JPG, GIF up to 10MB each</p>
                    </div>
                  </>
                )}
              </label>
            </div>

            {/* Uploaded screenshots grid */}
            {editScreenshots.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {editScreenshots.map((url, index) => (
                  <div key={index} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
                    <img src={url} alt={`Screenshot ${index + 1}`} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                    <button
                      onClick={() => removeScreenshot(index)}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        backgroundColor: "rgba(0,0,0,0.6)",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      <X size={14} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Key Points Section */}
          <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#233217", margin: 0 }}>Key Points</h2>
              <button
                onClick={addBullet}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#233217",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={14} /> Add Point
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {editBullets.length === 0 ? (
                <p style={{ fontSize: 14, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>
                  No key points added yet. Click &quot;Add Point&quot; to add bullets.
                </p>
              ) : (
                editBullets.map((bullet, index) => (
                  <div key={index} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: "50%", 
                      backgroundColor: "#233217", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{index + 1}</span>
                    </div>
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) => updateBullet(index, e.target.value)}
                      placeholder={`Point ${index + 1}...`}
                      style={{ flex: 1, height: 40, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textDark, fontWeight: 500, outline: "none" }}
                      onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
                      onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                    />
                    <button
                      onClick={() => removeBullet(index)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: "none",
                        backgroundColor: "#fee2e2",
                        color: "#dc2626",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Save/Cancel */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving || !editTitle.trim()}
              style={{
                height: 46,
                padding: "0 24px",
                borderRadius: 10,
                border: "none",
                backgroundColor: saving || !editTitle.trim() ? T.border : "#233217",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: saving || !editTitle.trim() ? "not-allowed" : "pointer",
                boxShadow: saving || !editTitle.trim() ? "none" : "0 4px 12px rgba(35, 50, 23, 0.2)",
              }}
            >
              {saving ? "Saving..." : "Save Guide"}
            </button>
            <button
              onClick={() => setView("list")}
              style={{
                height: 46,
                padding: "0 24px",
                borderRadius: 10,
                border: `1.5px solid ${T.border}`,
                backgroundColor: "#fff",
                color: T.textDark,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#233217", margin: "0 0 8px 0" }}>Product Guide</h1>
          <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>Browse help articles and tutorials</p>
        </div>
        <button
          onClick={() => setIsAdminMode(!isAdminMode)}
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 10,
            border: isAdminMode ? "none" : `1.5px solid #233217`,
            backgroundColor: isAdminMode ? "#233217" : "transparent",
            color: isAdminMode ? "#fff" : "#233217",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          {isAdminMode ? "Exit Admin Mode" : "Admin Mode"}
        </button>
      </div>

      {/* Search & Filters */}
      <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 300px" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted, zIndex: 1 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guides..."
              style={{ width: "100%", height: 40, paddingLeft: 38, paddingRight: 14, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.textDark, fontWeight: 500, outline: "none", backgroundColor: T.pageBg }}
              onFocus={(e) => { e.target.style.borderColor = "#233217"; e.target.style.boxShadow = `0 0 0 3px rgba(35, 50, 23, 0.1)`; }}
              onBlur={(e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <StyledSelect
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              options={[{ value: "All", label: "All Categories" }, ...categories.map(c => ({ value: c, label: c }))]}
            />
          </div>
        </div>
      </div>

      {/* Guide Grid */}
      {loading ? (
        <div style={{ padding: "80px 0", display: "flex", justifyContent: "center" }}>
          <LoadingSpinner size={48} label="Loading guides..." />
        </div>
      ) : filteredGuides.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: T.blueFaint, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <FileText size={28} color={T.blue} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.textMuted, margin: "0 0 8px 0" }}>No guides found</p>
          <p style={{ fontSize: 14, color: T.textMid, margin: 0 }}>Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {filteredGuides.map((guide) => (
            <div
              key={guide.id}
              onClick={() => openGuide(guide)}
              style={{
                backgroundColor: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                overflow: "hidden",
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "#233217";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              }}
            >
              {/* Media Preview */}
              <div style={{ height: 140, backgroundColor: T.pageBg, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${T.borderLight}` }}>
                {guide.video_url ? (
                  <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#233217", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Play size={24} color="#fff" fill="#fff" />
                  </div>
                ) : guide.screenshots && guide.screenshots.length > 0 ? (
                  <img src={guide.screenshots[0]} alt={guide.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: T.blueFaint, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={24} color={T.blue} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{guide.category}</div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#233217", margin: "0 0 8px 0", lineHeight: 1.3 }}>{guide.title}</h3>
                {guide.description && (
                  <p style={{ fontSize: 13, color: T.textMid, margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {guide.description}
                  </p>
                )}
              </div>

              {/* Admin Actions */}
              {isAdminMode && (
                <div style={{ display: "flex", gap: 8, padding: "0 16px 16px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(guide); }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      height: 36,
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      backgroundColor: "#fff",
                      color: "#233217",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDeleteModal(guide); }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      border: `1px solid #fecaca`,
                      backgroundColor: "#fff",
                      color: "#dc2626",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create New Guide Button (Admin Mode) */}
      {isAdminMode && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={openCreate}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "16px",
              borderRadius: 12,
              border: `2px dashed ${T.border}`,
              backgroundColor: "transparent",
              color: T.textMuted,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#233217";
              e.currentTarget.style.color = "#233217";
              e.currentTarget.style.backgroundColor = T.blueFaint;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.textMuted;
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Plus size={18} /> Create New Guide
          </button>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deletingGuide && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: 24, boxShadow: "0 18px 38px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dc2626" }}>Delete Guide</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textMuted }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "#991b1b", lineHeight: 1.6 }}>
                Are you sure you want to permanently delete <strong>&quot;{deletingGuide.title}&quot;</strong>? This action cannot be undone.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  color: T.textDark,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingInProgress}
                style={{
                  height: 42,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: !deletingInProgress ? "#dc2626" : T.border,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: !deletingInProgress ? "pointer" : "not-allowed",
                  boxShadow: !deletingInProgress ? "0 4px 12px rgba(220, 38, 38, 0.2)" : "none",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {deletingInProgress ? "Deleting..." : "Delete Guide"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
