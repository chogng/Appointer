// ... existing imports
import React, {
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from "react";
import Papa from "papaparse";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";

/*
 * Separate component for the expanded card animation.
 * Using a portal to break out of the scrollable container.
 */
const ExpandedCard = ({ file, originRect, containerBounds, onClose, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Trigger expansion after mount
    requestAnimationFrame(() => {
      setIsExpanded(true);
    });
  }, []);

  // Safety check
  if (!originRect) return null;

  // Calculate dimensions and position
  // Estimate text width: ~8px per char + moderate padding
  // Min width 300 to avoid too much whitespace on short names
  const textWidthEstimate = (file.name.length * 8) + 70;
  const expandedWidth = Math.max(originRect.width, Math.max(300, textWidthEstimate));

  // Determine boundaries, default to window if no container bounds passed
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  // If containerBounds are provided, use them as constraints (plus padding), otherwise fallback to viewport 24px
  const minLeft = containerBounds ? containerBounds.left : 24;
  const maxRight = containerBounds ? containerBounds.right : (windowWidth - 24);

  // Center expansion: grow from center
  let targetLeft = originRect.left + (originRect.width / 2) - (expandedWidth / 2);

  // Clamp to bounds
  // 1. Right edge check
  if (targetLeft + expandedWidth > maxRight) {
    targetLeft = maxRight - expandedWidth;
  }
  // 2. Left edge check (priority over right if conflict, or min width dictates)
  if (targetLeft < minLeft) {
    targetLeft = minLeft;
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${isExpanded ? "bg-black/5" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* Card */}
      <div
        className="fixed z-50 bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden flex items-center justify-between"
        style={{
          top: originRect.top,
          left: isExpanded ? targetLeft : originRect.left,
          height: originRect.height,
          // Animate width and transform
          width: isExpanded
            ? expandedWidth
            : originRect.width,
          transform: isExpanded ? `translate(0, -4px)` : "none", // Slight pop up
          // Use transition for smooth animation
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex items-center gap-3 px-3 w-full overflow-hidden">
          <div className="w-8 h-8 rounded bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
            <FileText size={16} />
          </div>
          {/* Full filename display */}
          <span
            className="text-sm text-text-primary whitespace-nowrap overflow-hidden text-ellipsis"
            style={{
              maxWidth: "100%",
            }}
          >
            {file.name}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="mr-3 text-text-secondary hover:text-red-500 transition-colors hover:bg-bg-page p-1 rounded shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </>,
    document.body,
  );
};

const CsvImporter = forwardRef(({ onDataImported, onDataRemoved }, ref) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  // State for the expanded card animation
  const [activeFile, setActiveFile] = useState(null);
  const [originRect, setOriginRect] = useState(null);
  const [containerBounds, setContainerBounds] = useState(null);
  const containerRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      openFileDialog: () => {
        setError(null);
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      },
      hasFiles: files.length > 0,
    }),
    [files],
  );

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [files]);

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    processFiles(selectedFiles);
    // Reset input value to allow selecting same files again if needed
    event.target.value = "";
  };

  const processFiles = (newFiles) => {
    setError(null);

    // Filter out duplicates based on already loaded files
    // Note: This relies on 'files' state being up to date.
    // Ideally we should also check against currently processing files if async,
    // but for this use case, checking against state is sufficient for sequential drops/selects.
    const uniqueFiles = newFiles.filter((newFile) => {
      const isDuplicate = files.some(
        (existing) =>
          existing.name === newFile.name && existing.size === newFile.size,
      );
      if (isDuplicate) {
        console.log(`Skipping duplicate file: ${newFile.name}`);
      }
      return !isDuplicate;
    });

    if (uniqueFiles.length === 0 && newFiles.length > 0) {
      // If all files were duplicates (and we had some input)
      return;
    }

    // Parse each file
    uniqueFiles.forEach((file) => {
      // Skip non-CSV files (double check)
      if (!file.name.toLowerCase().endsWith(".csv")) return;

      Papa.parse(file, {
        complete: (results) => {
          // Only add to files list if parsing succeeded
          setFiles((prev) => {
            // Avoid duplicates
            if (
              prev.some((f) => f.name === file.name && f.size === file.size)
            ) {
              return prev;
            }
            return [...prev, file];
          });

          onDataImported({
            fileName: file.name,
            data: results.data,
            fileId: Math.random().toString(36).substr(2, 9),
          });
        },
        header: false,
        skipEmptyLines: true,
        error: (err) => {
          // Show parse errors
          console.error(`Error parsing ${file.name}:`, err);
          setError((prev) =>
            prev
              ? `${prev}\nFailed to read ${file.name}`
              : `Failed to read ${file.name}: ${err.message}`,
          );
        },
      });
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const csvFiles = [];

    // Helper to traverse directories
    const traverse = async (entry) => {
      if (entry.isFile) {
        if (entry.name.toLowerCase().endsWith(".csv")) {
          // Get File object from FileEntry
          const file = await new Promise((resolve) => entry.file(resolve));
          csvFiles.push(file);
        }
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        // createReader().readEntries() might not return all entries in one call
        // usually need to loop until empty, but for simple implementation:
        const entries = await new Promise((resolve) => {
          reader.readEntries(resolve);
        });
        for (const child of entries) {
          await traverse(child);
        }
      }
    };

    // Process all dropped items
    const promises = items.map((item) => {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        return traverse(entry);
      } else {
        // Fallback for non-entry items (rare in modern browsers)
        const file = item.getAsFile();
        if (file && file.name.toLowerCase().endsWith(".csv")) {
          csvFiles.push(file);
        }
      }
    });

    await Promise.all(promises);

    if (csvFiles.length === 0) {
      setError("No CSV files found in the dropped items.");
    } else {
      processFiles(csvFiles);
    }
  };

  const removeFile = (fileName) => {
    setFiles(files.filter((f) => f.name !== fileName));
    if (activeFile?.name === fileName) {
      handleCloseExpanded();
    }
    // Notify parent to remove data
    if (onDataRemoved) {
      onDataRemoved(fileName);
    }
  };

  const handleCardClick = (file, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setOriginRect(rect);
    setActiveFile(file);
    if (containerRef.current) {
      setContainerBounds(containerRef.current.getBoundingClientRect());
    }
  };

  const handleCloseExpanded = () => {
    setActiveFile(null);
    setOriginRect(null);
  };

  return (
    <div className="mb-6">
      <div
        ref={containerRef}
        className={`
                    border-2 border-dashed rounded-xl pl-6 pr-[18px] text-center transition-all duration-300 relative
                    h-[300px] overflow-y-auto custom-scrollbar
                    ${isDragging ? "border-accent bg-accent/5" : "border-text-secondary/40 hover:border-text-secondary"}
                `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={
          files.length === 0 ? () => fileInputRef.current.click() : undefined
        }
      >
        <input
          type="file"
          multiple
          accept=".csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
        />


        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-6 cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <Upload size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                Upload CSV files
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Drag files here or{" "}
                <span className="text-accent hover:underline">browse</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full min-h-full flex flex-col py-6">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 text-left">
              {/* Reverse to show newest first? Or just append. Currently appending. */}
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  onClick={(e) => handleCardClick(file, e)}
                  className={`
                                        flex items-center justify-between p-3 bg-bg-surface border border-border rounded-lg
                                        group shadow-sm hover:shadow-md transition-all cursor-pointer relative
                                        ${activeFile?.name === file.name ? "invisible" : ""}
                                    `}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                      <FileText size={16} />
                    </div>
                    <span className="text-sm text-text-primary truncate">
                      {file.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.name);
                    }}
                    className="text-text-secondary hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-bg-page p-1 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-500/10 rounded-lg mb-4 whitespace-pre-wrap">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Expanded Card Portal */}
      {activeFile && originRect && (
        <ExpandedCard
          file={activeFile}
          originRect={originRect}
          containerBounds={containerBounds}
          onClose={handleCloseExpanded}
          onRemove={() => removeFile(activeFile.name)}
        />
      )}
    </div>
  );
});

CsvImporter.displayName = "CsvImporter";

export default CsvImporter;
