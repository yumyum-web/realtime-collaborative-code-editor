import React, { useState } from "react";
import {
  VscGitCommit,
  VscChevronDown,
  VscChevronRight,
  VscFile,
  VscDiffAdded,
  VscDiffRemoved,
  VscDiffModified,
  VscHistory,
  VscPerson,
  VscCalendar,
} from "react-icons/vsc";

interface CommitFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions?: number;
  deletions?: number;
}

interface CommitDetails {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email?: string;
  date: string;
  files?: CommitFile[];
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
}

interface ExpandableCommitProps {
  commit: {
    _id?: string;
    message: string;
    author: string;
    timestamp: string;
  };
  onRestore?: (commitId: string) => void;
  onExpand?: (commitId: string) => Promise<CommitDetails | null>;
  loading?: boolean;
  disabled?: boolean;
}

export function ExpandableCommit({
  commit,
  onRestore,
  onExpand,
  loading = false,
  disabled = false,
}: ExpandableCommitProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleToggleExpand = async () => {
    if (!isExpanded && !details && onExpand && commit._id) {
      setLoadingDetails(true);
      try {
        const fetchedDetails = await onExpand(commit._id);
        setDetails(fetchedDetails);
      } catch (error) {
        console.error("Failed to fetch commit details:", error);
      } finally {
        setLoadingDetails(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "added":
        return <VscDiffAdded className="w-3.5 h-3.5 text-green-400" />;
      case "modified":
        return <VscDiffModified className="w-3.5 h-3.5 text-yellow-400" />;
      case "deleted":
        return <VscDiffRemoved className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <VscFile className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "added":
        return "text-green-400";
      case "modified":
        return "text-yellow-400";
      case "deleted":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else {
      return "Just now";
    }
  };

  return (
    <div className="bg-gray-700/50 border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-all">
      {/* Commit Header */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Expand/Collapse Button */}
          <button
            onClick={handleToggleExpand}
            className="mt-0.5 text-gray-400 hover:text-white transition-colors flex-shrink-0"
            disabled={loadingDetails}
          >
            {loadingDetails ? (
              <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : isExpanded ? (
              <VscChevronDown className="w-3.5 h-3.5" />
            ) : (
              <VscChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Commit Icon */}
          <VscGitCommit className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />

          {/* Commit Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white text-sm leading-tight mb-1.5 break-words">
              {commit.message}
            </h4>

            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <VscPerson className="w-3 h-3" />
                <span className="font-medium">{commit.author}</span>
              </div>

              {commit.timestamp && (
                <div className="flex items-center gap-1">
                  <VscCalendar className="w-3 h-3" />
                  <span>{formatDate(commit.timestamp)}</span>
                </div>
              )}

              {details && details.stats && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">
                    +{details.stats.additions}
                  </span>
                  <span className="text-red-400">
                    -{details.stats.deletions}
                  </span>
                </div>
              )}
            </div>

            {details && details.shortHash && (
              <div className="mt-1.5">
                <code className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">
                  {details.shortHash}
                </code>
              </div>
            )}
          </div>

          {/* Restore Button */}
          {onRestore && commit._id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore(commit._id!);
              }}
              disabled={loading || disabled}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-1 flex-shrink-0"
              title="Restore to this commit"
            >
              <VscHistory className="w-3 h-3" />
              <span className="hidden sm:inline">Restore</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && details && (
        <div className="border-t border-gray-600 bg-gray-800/50">
          {/* Detailed Metadata */}
          <div className="p-3 space-y-2 border-b border-gray-600">
            {details.email && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <VscPerson className="w-3 h-3" />
                <span className="font-medium">{details.author}</span>
                <span className="text-gray-500">&lt;{details.email}&gt;</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <VscCalendar className="w-3 h-3" />
              <span>
                {new Date(details.date).toLocaleString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>

            {details.hash && (
              <div className="flex items-center gap-2 text-xs">
                <VscGitCommit className="w-3 h-3 text-gray-400" />
                <code className="text-gray-400 font-mono">{details.hash}</code>
              </div>
            )}
          </div>

          {/* File Changes */}
          {details.files && details.files.length > 0 && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                  Changed Files ({details.files.length})
                </h5>
                {details.stats && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-400">
                      +{details.stats.additions}
                    </span>
                    <span className="text-red-400">
                      -{details.stats.deletions}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {details.files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-700/50 rounded border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    {getStatusIcon(file.status)}
                    <span
                      className="flex-1 text-xs text-gray-300 font-mono truncate"
                      title={file.path}
                    >
                      {file.path}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                      {file.additions !== undefined && file.additions > 0 && (
                        <span className="text-green-400">
                          +{file.additions}
                        </span>
                      )}
                      {file.deletions !== undefined && file.deletions > 0 && (
                        <span className="text-red-400">-{file.deletions}</span>
                      )}
                      <span
                        className={`${getStatusColor(file.status)} capitalize font-medium`}
                      >
                        {file.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {(!details.files || details.files.length === 0) && (
            <div className="p-4 text-center">
              <VscFile className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">
                No file changes information available
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
