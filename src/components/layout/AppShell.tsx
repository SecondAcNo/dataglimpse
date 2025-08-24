"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppBar, Box, CssBaseline, Divider, Drawer, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography, Tooltip
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DatasetIcon from "@mui/icons-material/Dataset";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import ShareNodesIcon from "@mui/icons-material/Share"; 
import SettingsIcon from "@mui/icons-material/Settings";
import HomeIcon from "@mui/icons-material/Home";
import Memory from "@mui/icons-material/Memory";
import Image from "next/image";
import { withBase } from "@/lib/basePath";

const drawerWidth = 240;  // 開いているとき
const miniWidth   = 72;   // 閉じているとき（アイコンのみ）

type NavItem = { id: string; label: string; href: string; icon: React.ReactNode };

const nav: NavItem[] = [
  { id: "dashboard", label: "ダッシュボード", href: "/", icon: <HomeIcon /> },
  { id: "dataroom",  label: "データルーム",   href: "/data",  icon: <DatasetIcon /> },
  { id: "query",     label: "クエリ",         href: "/query", icon: <QueryStatsIcon /> },
  { id: "er",        label: "ER",             href: "/er",    icon: <ShareNodesIcon /> },
  { id: "memory",  label: "メモリDB",       href: "/memory", icon: <Memory /> },
  { id: "theme",  label: "テーマ設定", href: "/theme", icon: <SettingsIcon /> }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);

  const handleMobileToggle  = () => setMobileOpen(v => !v);
  const handleDesktopToggle = () => setDesktopOpen(v => !v);

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2 }} >
        <Typography variant="h6" fontWeight={800}>DataSlimpse</Typography>
      </Box>
      <Divider />
      <List sx={{ py: 0 }}>
        {nav.map((n) => {
          const selected =
            n.href === "/"
              ? pathname === "/"
              : pathname.startsWith(n.href);

          const item = (
            <ListItemButton
              component={Link}
              href={n.href}
              selected={selected}
              sx={{
                px: desktopOpen ? 2 : 1.2,
                justifyContent: desktopOpen ? "flex-start" : "center",
                minHeight: 44,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: desktopOpen ? 2 : 0,
                  justifyContent: "center",
                }}
              >
                {n.icon}
              </ListItemIcon>
              {desktopOpen && <ListItemText primary={n.label} />}
            </ListItemButton>
          );

          return (
            <ListItem key={n.id} disablePadding>
              {desktopOpen ? item : <Tooltip title={n.label} placement="right">{item}</Tooltip>}
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ flex: 1 }} />
    </Box>
  );

  const railWidth = desktopOpen ? drawerWidth : miniWidth;

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          backdropFilter: "saturate(180%) blur(6px)",
          backgroundColor: (t) => t.palette.background.default,
        }}
      >
        <Toolbar>
          <IconButton
            color="default"
            edge="start"
            onClick={handleMobileToggle}
            sx={{ mr: 1.5, display: { xs: "inline-flex", md: "none" } }}
            aria-label="open navigation"
          >
            <MenuIcon />
          </IconButton>

          <IconButton
            color="default"
            edge="start"
            onClick={handleDesktopToggle}
            sx={{ mr: 1.5, display: { xs: "none", md: "inline-flex" } }}
            aria-label="toggle sidebar"
          >
            <MenuIcon />
          </IconButton>
          <Image src={withBase("/logo.svg")} width={24} height={24} unoptimized alt="..." />
          <Typography variant="h6" fontWeight={800}>DataGlimpse</Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: railWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleMobileToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": (t) => ({
              width: railWidth,
              boxSizing: "border-box",
              borderRight: `1px solid ${t.palette.divider}`,
              overflowX: "hidden",
              transition: t.transitions.create("width", {
                easing: t.transitions.easing.sharp,
                duration: t.transitions.duration.enteringScreen,
              }),
            }),
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, sm: 3, md: 4 },
          py: 3,
          width: { md: `calc(100% - ${railWidth}px)` },
          transition: (t) => t.transitions.create("width", {
            easing: t.transitions.easing.sharp,
            duration: t.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
