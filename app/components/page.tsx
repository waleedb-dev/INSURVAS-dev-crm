"use client";

import React, { useState } from "react";
import {
    Button,
    Input,
    Dropdown,
    Checkbox,
    Radio,
    Switch,
    SegmentedControl,
    Chip,
    Badge,
    ProgressSpinner,
    Avatar,
} from "@/components/ui";
import {
    IconPlus,
    IconChevronRight,
    IconPlayerPlay,
    IconLayoutKanban,
    IconSearch,
    IconBell,
    IconStar,
    IconSettings,
    IconUser,
    IconHome,
    IconFolder,
    IconCalendar,
    IconMail,
    IconPhone,
    IconFlag,
    IconHeart,
    IconBookmark,
    IconDownload,
    IconUpload,
    IconEdit,
    IconTrash,
    IconCopy,
    IconShare,
    IconLink,
    IconEye,
    IconLock,
    IconCheck,
    IconX,
    IconAlertCircle,
    IconInfoCircle,
    IconAlertTriangle,
    IconClock,
    IconMap,
    IconTrendingUp,
    IconUsers,
    IconDashboard,
    IconBriefcase,
    IconTag,
    IconMessage,
    IconAntenna,
    IconCloud,
    IconDatabase,
    IconCode,
    IconGlobe,
    IconAward,
    IconThumbUp,
    IconArrowRight,
    IconArrowLeft,
    IconArrowUp,
    IconArrowDown,
    IconDotsVertical,
    IconChevronDown,
    IconChevronUp,
    IconListDetails,
    IconTable,
    IconTimeline,
} from "@tabler/icons-react";

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr",
                gap: 0,
                borderBottom: "1px solid #f0f2f5",
            }}
        >
            {/* Left label */}
            <div
                style={{
                    padding: "32px 24px 32px 0",
                    borderRight: "1px solid #f0f2f5",
                }}
            >
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a2e", marginBottom: 6 }}>
                    {title}
                </div>
                {description && (
                    <div style={{ fontSize: 12, color: "#6b7a5f", fontWeight: 500, lineHeight: 1.5 }}>
                        {description}
                    </div>
                )}
            </div>

            {/* Right content */}
            <div style={{ padding: "32px 0 32px 32px" }}>
                {children}
            </div>
        </div>
    );
}

// ─── State column header ──────────────────────────────────────────────────────
function StateColumns({
    states,
    children,
}: {
    states: string[];
    children: React.ReactNode[];
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${states.length}, 1fr)`, gap: 16 }}>
                {states.map((s) => (
                    <div
                        key={s}
                        style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em" }}
                    >
                        {s}
                    </div>
                ))}
            </div>
            {/* Content rows */}
            {children.map((row, i) => (
                <div
                    key={i}
                    style={{ display: "grid", gridTemplateColumns: `repeat(${states.length}, 1fr)`, gap: 16, alignItems: "center" }}
                >
                    {row}
                </div>
            ))}
        </div>
    );
}

// ─── Icon grid ────────────────────────────────────────────────────────────────
function IconGrid({ icons, color = "#2e3429" }: { icons: React.ReactNode[]; color?: string }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {icons.map((icon, i) => (
                <div
                    key={i}
                    style={{
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 8,
                        color,
                        transition: "background 0.15s",
                        cursor: "pointer",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = "#f3f4f6")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent")}
                    title={`Icon ${i + 1}`}
                >
                    {icon}
                </div>
            ))}
        </div>
    );
}

// ─── Main showcase page ───────────────────────────────────────────────────────
export default function ComponentsPage() {
    const [checkboxChecked, setCheckboxChecked] = useState(true);
    const [radioSelected, setRadioSelected] = useState(true);
    const [switchOn, setSwitchOn] = useState(true);
    const [segmentProject, setSegmentProject] = useState("projects");
    const [segmentView, setSegmentView] = useState("list");
    const [chipSelected, setChipSelected] = useState(true);
    const [inputChipMembers, setInputChipMembers] = useState(["Violet Robbins"]);
    const [dropdownValue, setDropdownValue] = useState("current");
    const [avatarDropdown, setAvatarDropdown] = useState("evan");

    const dropdownOptions = [
        { label: "Current Projects", value: "current" },
        { label: "Backlog", value: "backlog" },
        { label: "Completed Projects", value: "completed" },
    ];

    const avatarOptions = [
        { label: "Evan Yates", value: "evan" },
        { label: "Sarah Connor", value: "sarah" },
        { label: "Mike Johnson", value: "mike" },
    ];

    const outlinedIcons = [
        <IconHome size={20} />, <IconSearch size={20} />, <IconBell size={20} />,
        <IconStar size={20} />, <IconSettings size={20} />, <IconUser size={20} />,
        <IconFolder size={20} />, <IconCalendar size={20} />, <IconMail size={20} />,
        <IconPhone size={20} />, <IconFlag size={20} />, <IconHeart size={20} />,
        <IconBookmark size={20} />, <IconDownload size={20} />, <IconUpload size={20} />,
        <IconEdit size={20} />, <IconTrash size={20} />, <IconCopy size={20} />,
        <IconShare size={20} />, <IconLink size={20} />, <IconEye size={20} />,
        <IconLock size={20} />, <IconCheck size={20} />, <IconX size={20} />,
    ];

    const sidebarIcons = [
        <IconDashboard size={20} />, <IconUsers size={20} />, <IconBriefcase size={20} />,
        <IconCalendar size={20} />, <IconMessage size={20} />, <IconTrendingUp size={20} />,
        <IconFolder size={20} />, <IconTag size={20} />, <IconGlobe size={20} />,
        <IconDatabase size={20} />, <IconCloud size={20} />, <IconCode size={20} />,
        <IconAward size={20} />, <IconThumbUp size={20} />, <IconMap size={20} />,
        <IconAntenna size={20} />, <IconClock size={20} />, <IconSettings size={20} />,
    ];

    const filledIcons = [
        <IconHome size={20} fill="#638b4b" color="#638b4b" />,
        <IconSearch size={20} fill="#638b4b" color="#638b4b" />,
        <IconBell size={20} fill="#638b4b" color="#638b4b" />,
        <IconStar size={20} fill="#74a557" color="#74a557" />,
        <IconHeart size={20} fill="#3b5229" color="#3b5229" />,
        <IconBookmark size={20} fill="#638b4b" color="#638b4b" />,
        <IconFlag size={20} fill="#3b5229" color="#3b5229" />,
        <IconThumbUp size={20} fill="#638b4b" color="#638b4b" />,
    ];

    return (
        <div
            style={{
                backgroundColor: "#f8f9fc",
                minHeight: "100vh",
                fontFamily: "'Nunito Sans', sans-serif",
            }}
        >
            {/* ── Page header ── */}
            <div
                style={{
                    backgroundColor: "white",
                    borderBottom: "1px solid #f0f2f5",
                    padding: "28px 48px",
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                    boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
                }}
            >
                <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>
                    UI Components
                </h1>
                <p style={{ fontSize: 14, color: "#6b7a5f", margin: "4px 0 0", fontWeight: 500 }}>
                    Reusable building blocks — Nunito Sans · Tabler Icons
                </p>
            </div>

            {/* ── Component sections ── */}
            <div
                style={{
                    maxWidth: 1100,
                    margin: "0 auto",
                    padding: "0 48px 80px",
                    backgroundColor: "white",
                }}
            >
                {/* ─── BUTTONS ─────────────────────────────────────────────── */}
                <Section title="Buttons" description="Types and states of buttons">
                    <StateColumns
                        states={["Enabled", "Hover", "Pressed", "Disabled"]}
                    >
                        {/* Primary */}
                        {[
                            <Button><IconPlus size={16} />Add Project</Button>,
                            <Button><IconPlus size={16} />Add Project</Button>,
                            <Button><IconPlus size={16} />Add Project</Button>,
                            <Button disabled><IconPlus size={16} />Add Project</Button>,
                        ]}

                        {/* Secondary */}
                        {[
                            <Button variant="secondary">Save Task</Button>,
                            <Button variant="secondary">Save Task</Button>,
                            <Button variant="secondary">Save Task</Button>,
                            <Button variant="secondary" disabled>Save Task</Button>,
                        ]}

                        {/* Icon */}
                        {[
                            <Button size="icon-sm"><IconPlayerPlay size={16} /></Button>,
                            <Button size="icon-sm"><IconPlayerPlay size={16} /></Button>,
                            <Button size="icon-sm"><IconPlayerPlay size={16} /></Button>,
                            <Button size="icon-sm" disabled><IconPlayerPlay size={16} /></Button>,
                        ]}

                        {/* Link */}
                        {[
                            <Button variant="link">View all <IconChevronRight size={14} /></Button>,
                            <Button variant="link">View all <IconChevronRight size={14} /></Button>,
                            <Button variant="link">View all <IconChevronRight size={14} /></Button>,
                            <Button variant="link" disabled>View all <IconChevronRight size={14} /></Button>,
                        ]}

                        {/* Ghost icon */}
                        {[
                            <Button variant="ghost" size="icon-sm"><IconLayoutKanban size={16} /></Button>,
                            <Button variant="ghost" size="icon-sm"><IconLayoutKanban size={16} /></Button>,
                            <Button variant="ghost" size="icon-sm"><IconLayoutKanban size={16} /></Button>,
                            <Button variant="ghost" size="icon-sm" disabled><IconLayoutKanban size={16} /></Button>,
                        ]}
                    </StateColumns>
                </Section>

                {/* ─── INPUTS ──────────────────────────────────────────────── */}
                <Section title="Inputs" description="States, text styles, colors">
                    <StateColumns states={["Inactive", "Active", "Disabled"]}>
                        {[
                            <Input label="Position" placeholder="UI/UX Designer" state="inactive" />,
                            <Input label="Position" placeholder="UI/UX Designer" state="active" />,
                            <Input label="Position" placeholder="UI/UX Designer" state="disabled" />,
                        ]}
                    </StateColumns>

                    <div style={{ marginTop: 24 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                            Error
                        </div>
                        <Input
                            label="Position"
                            defaultValue="UI/UX Designer"
                            state="error"
                            errorMessage="Incorrect data"
                            style={{ maxWidth: 280 }}
                        />
                    </div>
                </Section>

                {/* ─── DROPDOWNS ───────────────────────────────────────────── */}
                <Section title="Dropdowns" description="How component works">
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <Dropdown
                            options={dropdownOptions}
                            value={dropdownValue}
                            onChange={setDropdownValue}
                        />
                        <Dropdown
                            options={avatarOptions}
                            value={avatarDropdown}
                            onChange={setAvatarDropdown}
                            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Evan"
                            avatarLabel="Evan Yates"
                        />
                    </div>
                </Section>

                {/* ─── CONTROLS ────────────────────────────────────────────── */}
                <Section title="Controls" description="Checkboxes, Radio buttons, Switches, Segmented Controls">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
                        {/* Checkboxes */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 14 }}>
                                Checkboxes
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <Checkbox checked={checkboxChecked} onChange={setCheckboxChecked} label="Checked" />
                                <Checkbox checked={false} label="Unchecked" />
                                <Checkbox checked={true} disabled label="Disabled" />
                                <Checkbox checked={false} indeterminate label="Partial" />
                            </div>
                        </div>

                        {/* Radio */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 14 }}>
                                Radio buttons
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <Radio checked={radioSelected} onChange={setRadioSelected} label="Selected" />
                                <Radio checked={false} label="Unselected" />
                                <Radio checked={true} disabled label="Disabled" />
                            </div>
                        </div>

                        {/* Switches */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 14 }}>
                                Switches
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <Switch checked={switchOn} onChange={setSwitchOn} label="Switched on" />
                                <Switch checked={false} label="Switched off" />
                                <Switch checked={true} disabled label="Disabled" />
                            </div>
                        </div>

                        {/* Segmented */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 14 }}>
                                Segmented Controls
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <SegmentedControl
                                    options={[{ label: "Projects", value: "projects" }, { label: "Team", value: "team" }]}
                                    value={segmentProject}
                                    onChange={setSegmentProject}
                                />
                                <SegmentedControl
                                    options={[
                                        { label: "List", value: "list" },
                                        { label: "Board", value: "board" },
                                        { label: "Timeline", value: "timeline" },
                                    ]}
                                    value={segmentView}
                                    onChange={setSegmentView}
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ─── CHIPS ───────────────────────────────────────────────── */}
                <Section title="Chips" description="Choice and input chips">
                    <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                        {/* Choice chips */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Choice chips
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Chip label="Tax" selected={chipSelected} onToggle={() => setChipSelected(!chipSelected)} />
                                <Chip label="Map" selected={false} onToggle={() => { }} />
                                <Chip label="Design" selected={false} onToggle={() => { }} />
                            </div>
                        </div>

                        {/* Input chips */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Input chips
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {inputChipMembers.map((name) => (
                                    <Chip
                                        key={name}
                                        label={name}
                                        variant="input"
                                        avatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`}
                                        onRemove={() => setInputChipMembers(inputChipMembers.filter((m) => m !== name))}
                                    />
                                ))}
                                {inputChipMembers.length === 0 && (
                                    <button
                                        onClick={() => setInputChipMembers(["Violet Robbins"])}
                                        style={{
                                            fontSize: 13, color: "#638b4b", fontWeight: 600,
                                            background: "none", border: "1.5px dashed #638b4b",
                                            borderRadius: 20, padding: "5px 14px", cursor: "pointer",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        + Add member
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ─── ICONS ───────────────────────────────────────────────── */}
                <Section title="Icons" description="Side bar and general icons">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Outlined Icons
                            </div>
                            <IconGrid icons={outlinedIcons} color="#2e3429" />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Side Bar Icons
                            </div>
                            <IconGrid icons={sidebarIcons} color="#638b4b" />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Filled Icons
                            </div>
                            <IconGrid icons={filledIcons} />
                        </div>
                    </div>
                </Section>

                {/* ─── OTHER ELEMENTS ──────────────────────────────────────── */}
                <Section title="Other Elements" description="Task statuses, Vacation statuses, Progress, Vacation Indicators, Employees' level">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36 }}>
                        {/* Task statuses */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Task statuses
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Badge variant="todo" />
                                <Badge variant="in-progress" />
                                <Badge variant="in-review" />
                                <Badge variant="done" />
                            </div>
                        </div>

                        {/* Vacation Indicators */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Vacation Indicators
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                                {/* Sick Leave */}
                                <div>
                                    <div style={{ fontSize: 12, color: "#6b7a5f", fontWeight: 600, marginBottom: 8 }}>Sick Leave</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <Badge variant="approved" dot label="Approved" />
                                        <Badge variant="pending" dot label="Pending" />
                                    </div>
                                </div>
                                {/* Vacation */}
                                <div>
                                    <div style={{ fontSize: 12, color: "#6b7a5f", fontWeight: 600, marginBottom: 8 }}>Vacation</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <Badge variant="approved" dot label="Approved" />
                                        <Badge variant="pending" dot label="Pending" />
                                    </div>
                                </div>
                                {/* Remote */}
                                <div>
                                    <div style={{ fontSize: 12, color: "#6b7a5f", fontWeight: 600, marginBottom: 8 }}>Work Remotely</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <Badge variant="approved" dot label="Approved" />
                                        <Badge variant="pending" dot label="Pending" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Vacation statuses */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Vacation statuses
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Badge variant="approved" />
                                <Badge variant="pending" />
                            </div>
                        </div>

                        {/* Progress */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Progress
                            </div>
                            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                                <ProgressSpinner value={65} size={52} />
                                <ProgressSpinner value={30} size={52} color="#638b4b" />
                                <ProgressSpinner value={85} size={52} color="#4e6e3a" />
                            </div>
                        </div>

                        {/* Employees' level */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Employees&apos; level
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Badge variant="junior" />
                                <Badge variant="middle" />
                                <Badge variant="senior" />
                            </div>
                        </div>

                        {/* Avatars */}
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7a5f", letterSpacing: "0.04em", marginBottom: 12 }}>
                                Avatars
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <Avatar name="Evan Yates" size={40} />
                                <Avatar name="Violet Robbins" size={40} />
                                <Avatar name="Sarah Connor" size={40} />
                                <Avatar name="Mike Johnson" size={36} />
                                <Avatar name="Anna Lee" size={30} />
                            </div>
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}
