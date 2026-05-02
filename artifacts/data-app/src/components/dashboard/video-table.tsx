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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCompact, formatDate, formatPercent } from "@/lib/formatters";
import type { VideoRow } from "@workspace/api-client-react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function VideoTable({ data }: { data: VideoRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<VideoRow>[] = [
    {
      accessorKey: "title",
      header: "Video",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-8 rounded shrink-0" 
            style={{ backgroundColor: row.original.thumbnailColor || "#333" }} 
          />
          <div>
            <p className="font-medium text-[13px] leading-tight line-clamp-1 max-w-[200px] text-foreground">{row.original.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(row.original.publishedAt)}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "views",
      header: ({ column }) => <SortableHeader column={column} title="Views" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.views.toLocaleString()}</span>,
    },
    {
      accessorKey: "likes",
      header: ({ column }) => <SortableHeader column={column} title="Likes" />,
      cell: ({ row }) => <span className="font-mono text-xs">{formatCompact(row.original.likes)}</span>,
    },
    {
      accessorKey: "comments",
      header: ({ column }) => <SortableHeader column={column} title="Comments" />,
      cell: ({ row }) => <span className="font-mono text-xs">{formatCompact(row.original.comments)}</span>,
    },
    {
      accessorKey: "watchTimeHours",
      header: ({ column }) => <SortableHeader column={column} title="Watch Time" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.watchTimeHours.toLocaleString()}h</span>,
    },
    {
      accessorKey: "engagementRate",
      header: ({ column }) => <SortableHeader column={column} title="Engagement" />,
      cell: ({ row }) => <span className="font-mono text-xs">{formatPercent(row.original.engagementRate)}</span>,
    },
    {
      accessorKey: "duration",
      header: "Length",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.duration}</span>,
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search videos..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs h-8 text-xs bg-muted/50 border-border"
        />
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-border">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-9 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-border hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  No videos found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
          {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "}
          of {table.getFilteredRowModel().rows.length} results
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Prev</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({ column, title }: { column: any, title: string }) {
  return (
    <div 
      className="flex items-center gap-1.5 cursor-pointer select-none group" 
      onClick={column.getToggleSortingHandler()}
    >
      {title}
      {{
        asc: <ArrowUp className="w-3 h-3 text-foreground" />,
        desc: <ArrowDown className="w-3 h-3 text-foreground" />,
      }[column.getIsSorted() as string] ?? <ArrowUpDown className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />}
    </div>
  );
}
