import React, { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  formatCompact,
  formatDate,
  formatPercent,
  formatNumber,
  isMissing,
} from "@/lib/formatters";
import type { VideoRow } from "@workspace/api-client-react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function VideoTable({
  data,
  accent,
}: {
  data: VideoRow[];
  /** Optional accent color used for thumbnail placeholders. */
  accent?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<VideoRow>[] = [
    {
      accessorKey: "title",
      header: "Video",
      cell: ({ row }) => {
        // Backend currently returns "#FF0000" for every thumbnailColor — fall
        // back to the channel accent so titles aren't all flagged red.
        // TODO: needs API field `thumbnailUrl` to render real thumbnails.
        const swatch =
          row.original.thumbnailColor &&
          row.original.thumbnailColor.toLowerCase() !== "#ff0000"
            ? row.original.thumbnailColor
            : accent || "#3f3f46";
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-8 rounded shrink-0 opacity-80"
              style={{ backgroundColor: swatch }}
            />
            <div className="min-w-0">
              <p className="font-medium text-[13px] leading-tight line-clamp-1 max-w-[260px] text-foreground">
                {row.original.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {formatDate(row.original.publishedAt)}
                {row.original.duration ? (
                  <>
                    <span className="mx-1.5 text-muted-foreground/50">·</span>
                    {row.original.duration}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "views",
      header: ({ column }) => <SortableHeader column={column} title="Views" />,
      cell: ({ row }) => (
        <NumCell value={row.original.views} format="full" />
      ),
    },
    {
      accessorKey: "likes",
      header: ({ column }) => <SortableHeader column={column} title="Likes" />,
      cell: ({ row }) => (
        <NumCell value={row.original.likes} format="compact" />
      ),
    },
    {
      accessorKey: "comments",
      header: ({ column }) => (
        <SortableHeader column={column} title="Comments" />
      ),
      cell: ({ row }) => (
        <NumCell value={row.original.comments} format="compact" />
      ),
    },
    {
      accessorKey: "watchTimeHours",
      header: ({ column }) => (
        <SortableHeader column={column} title="Watch Time" />
      ),
      cell: ({ row }) => {
        const v = row.original.watchTimeHours;
        return (
          <span
            className={`font-mono text-xs tabular-nums ${
              isMissing(v) ? "text-muted-foreground/50" : ""
            }`}
          >
            {isMissing(v) ? "—" : `${(v as number).toLocaleString()}h`}
          </span>
        );
      },
    },
    {
      accessorKey: "engagementRate",
      header: ({ column }) => (
        <SortableHeader column={column} title="Engagement" />
      ),
      cell: ({ row }) => (
        <span
          className={`font-mono text-xs tabular-nums ${
            isMissing(row.original.engagementRate)
              ? "text-muted-foreground/50"
              : ""
          }`}
        >
          {formatPercent(row.original.engagementRate)}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (data.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-md py-10 text-center text-sm text-muted-foreground">
        No videos to show.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search videos…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs h-8 text-xs bg-muted/50 border-border"
        />
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent border-border"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-9 text-[11px] font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wider"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No videos match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getFilteredRowModel().rows.length > 10 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-mono tabular-nums">
            Showing{" "}
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}
            –
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length,
            )}{" "}
            of {table.getFilteredRowModel().rows.length}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumCell({
  value,
  format,
}: {
  value: number | null | undefined;
  format: "full" | "compact";
}) {
  if (isMissing(value)) {
    return <span className="font-mono text-xs text-muted-foreground/50">—</span>;
  }
  return (
    <span className="font-mono text-xs tabular-nums">
      {format === "full" ? formatNumber(value) : formatCompact(value)}
    </span>
  );
}

function SortableHeader({
  column,
  title,
}: {
  column: any;
  title: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 cursor-pointer select-none group"
      onClick={column.getToggleSortingHandler()}
    >
      {title}
      {{
        asc: <ArrowUp className="w-3 h-3 text-foreground" />,
        desc: <ArrowDown className="w-3 h-3 text-foreground" />,
      }[column.getIsSorted() as string] ?? (
        <ArrowUpDown className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      )}
    </div>
  );
}
