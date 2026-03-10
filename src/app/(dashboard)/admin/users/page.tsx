"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import { DataTable } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsGrid, CountStatCard } from "@/components/dashboard/stats-cards";

// ==========================================
// Types
// ==========================================

type UserRole = "STREAMER" | "BRAND" | "ADMIN";
type UserStatus = "active" | "banned" | "pending";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  _count: {
    clicks: number;
    conversions: number;
    campaigns: number;
  };
}

// ==========================================
// User Detail Modal
// ==========================================

function UserDetailPanel({
  user,
  onClose,
  onBan,
  onUnban,
}: {
  user: UserRow;
  onClose: () => void;
  onBan: (id: string, reason: string) => void;
  onUnban: (id: string) => void;
}) {
  const [banReason, setBanReason] = useState("");
  const [showBanForm, setShowBanForm] = useState(false);

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">{user.name || "Unnamed"}</CardTitle>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <StatusBadge
              status={user.role}
              map={{
                ADMIN: "info",
                BRAND: "warning",
                STREAMER: "success",
              }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <StatusBadge
              status={user.status}
              map={{
                active: "success",
                banned: "error",
                pending: "warning",
              }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="font-semibold">{user._count.clicks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conversions</p>
            <p className="font-semibold">{user._count.conversions.toLocaleString()}</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </div>

        {/* Ban / Unban actions */}
        {user.status === "banned" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUnban(user.id)}
          >
            Unban User
          </Button>
        ) : (
          <>
            {!showBanForm ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBanForm(true)}
              >
                Ban User
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Reason for ban..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onBan(user.id, banReason);
                    setShowBanForm(false);
                    setBanReason("");
                  }}
                  disabled={!banReason.trim()}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBanForm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// Main Page
// ==========================================

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const { data, isLoading, refetch } = api.admin.listUsers.useQuery({
    page,
    limit: 25,
    search: search || undefined,
    role: roleFilter === "ALL" ? undefined : roleFilter,
  });

  const banMutation = api.admin.banUser.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedUser(null);
    },
  });

  const unbanMutation = api.admin.unbanUser.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedUser(null);
    },
  });

  const users = (data?.users ?? []) as UserRow[];
  const total = data?.total ?? 0;

  const columns = [
    {
      key: "name" as const,
      header: "Name",
      sortable: true,
      render: (row: UserRow) => (
        <button
          className="font-medium text-blue-600 hover:underline"
          onClick={() => setSelectedUser(row)}
        >
          {row.name || "Unnamed"}
        </button>
      ),
    },
    { key: "email" as const, header: "Email", sortable: true },
    {
      key: "role" as const,
      header: "Role",
      render: (row: UserRow) => (
        <StatusBadge
          status={row.role}
          map={{ ADMIN: "info", BRAND: "warning", STREAMER: "success" }}
        />
      ),
    },
    {
      key: "status" as const,
      header: "Status",
      render: (row: UserRow) => (
        <StatusBadge
          status={row.status}
          map={{ active: "success", banned: "error", pending: "warning" }}
        />
      ),
    },
    {
      key: "_count" as const,
      header: "Activity",
      render: (row: UserRow) => (
        <span className="text-sm text-muted-foreground">
          {row._count.clicks} clicks / {row._count.conversions} conv
        </span>
      ),
    },
    {
      key: "createdAt" as const,
      header: "Joined",
      sortable: true,
      render: (row: UserRow) =>
        new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          View, search, ban/unban platform users
        </p>
      </div>

      {/* Stats row */}
      <StatsGrid columns={4}>
        <CountStatCard title="Total Users" value={total} />
        <CountStatCard
          title="Streamers"
          value={users.filter((u) => u.role === "STREAMER").length}
        />
        <CountStatCard
          title="Brands"
          value={users.filter((u) => u.role === "BRAND").length}
        />
        <CountStatCard
          title="Banned"
          value={users.filter((u) => u.status === "banned").length}
        />
      </StatsGrid>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <div className="flex gap-2">
          {(["ALL", "STREAMER", "BRAND", "ADMIN"] as const).map((r) => (
            <Button
              key={r}
              variant={roleFilter === r ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRoleFilter(r);
                setPage(1);
              }}
            >
              {r === "ALL" ? "All" : r.charAt(0) + r.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Selected user detail */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onBan={(id, reason) => banMutation.mutate({ userId: id, reason })}
          onUnban={(id) => unbanMutation.mutate({ userId: id })}
        />
      )}

      {/* Table */}
      <DataTable
        data={users}
        columns={columns}
        pageSize={25}
        searchable={false}
        loading={isLoading}
      />

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / 25)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / 25)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
