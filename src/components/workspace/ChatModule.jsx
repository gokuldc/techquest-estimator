import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, TextField, IconButton, Avatar, Paper,
    Tabs, Tab, List, ListItem, ListItemAvatar, ListItemText, ListItemButton,
    Divider, Menu, MenuItem, Tooltip, Chip
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CloseIcon from '@mui/icons-material/Close'; // 🔥 ADDED CLOSE ICON

import { useAuth } from '../../context/AuthContext';

// 🔥 ADDED onClose PROP
export default function ChatModule({ projectId = null, orgStaff = [], onClose }) {
    const { currentUser } = useAuth();
    const dmStaffList = (orgStaff || []).filter(s => s.id !== currentUser?.id);

    const [viewMode, setViewMode] = useState(projectId ? 'project' : 'global');
    const [selectedDmUser, setSelectedDmUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    // --- State for Mentions & Attachments ---
    const [mentionSearch, setMentionSearch] = useState(null);
    const [cursorPos, setCursorPos] = useState(0);
    const [anchorEl, setAnchorEl] = useState(null); // For Attach Menu
    const [projectDocs, setProjectDocs] = useState([]); // List of files already in project

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null); // Hidden file input for web users

    const loadMessages = async () => {
        try {
            let data = [];
            if (viewMode === 'project' || viewMode === 'global') {
                data = await window.api.db.getMessages(projectId);
            } else if (viewMode === 'dm_chat' && selectedDmUser) {
                data = await window.api.db.getPrivateMessages(currentUser.id, selectedDmUser.id);
            }
            setMessages(data || []);
        } catch (error) { console.error("Chat load error:", error); }
    };

    // Load Project Docs for the "Link" feature
    const loadProjectDocs = async () => {
        if (!projectId) return;
        const docs = await window.api.db.getProjectDocuments(projectId);
        setProjectDocs(docs || []);
    };

    useEffect(() => {
        loadMessages();
        loadProjectDocs();
        const interval = setInterval(loadMessages, 4000);
        return () => clearInterval(interval);
    }, [projectId, viewMode, selectedDmUser]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // --- LOGIC: Mentions ---
    const handleInputChange = (e) => {
        const val = e.target.value;
        const selectionStart = e.target.selectionStart;
        setInput(val);
        setCursorPos(selectionStart);
        const textBeforeCursor = val.slice(0, selectionStart);
        const parts = textBeforeCursor.split(/\s/);
        const lastWord = parts[parts.length - 1];

        if (lastWord.startsWith('@')) setMentionSearch(lastWord.slice(1).toLowerCase());
        else setMentionSearch(null);
    };

    const handleMentionSelect = (username) => {
        const textBeforeCursor = input.slice(0, cursorPos);
        const textAfterCursor = input.slice(cursorPos);
        const parts = textBeforeCursor.split(/\s/);
        parts.pop();
        const prefix = parts.join(' ');
        setInput((prefix ? prefix + ' ' : '') + `@${username} ` + textAfterCursor);
        setMentionSearch(null);
        inputRef.current?.focus();
    };

    // --- LOGIC: Attachments & Linking ---
    const handleFileAttach = async (e) => {
        let filePath = "";
        let fileName = "";

        if (window.api?.os?.pickFile && !window.api.os.pickFile.isPolyfill) {
            // DESKTOP MODE: Native system access works
            filePath = await window.api.os.pickFile();
            if (!filePath) return;
            fileName = filePath.split('\\').pop().split('/').pop();
            sendSystemMessage(`📎 Attached: ${fileName}`, { type: 'file', path: filePath, name: fileName });
        } else {
            // NETWORK/WEB MODE: 
            alert("File uploads from mobile are currently disabled. Please link existing Project Documents or upload from the Desktop Host.");
        }
        setAnchorEl(null);
    };

    const handleLinkExistingDoc = (doc) => {
        sendSystemMessage(`🔗 Linked Drawing: ${doc.name}`, { type: 'doc_link', path: doc.path, name: doc.name });
        setAnchorEl(null);
    };

    const sendSystemMessage = async (text, metadata = null) => {
        const payload = {
            id: crypto.randomUUID(),
            content: metadata ? `__FILE_DATA__${JSON.stringify(metadata)}` : text,
            projectId: projectId,
            senderId: currentUser.id,
            createdAt: Date.now()
        };

        if (viewMode === 'dm_chat') {
            await window.api.db.savePrivateMessage({ ...payload, receiverId: selectedDmUser.id });
        } else {
            await window.api.db.saveMessage(payload);
        }
        loadMessages();
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        await sendSystemMessage(input.trim());
        setInput("");
        setMentionSearch(null);
    };

    // --- RENDERING: Messages with File Cards ---
    const renderMessageContent = (msg) => {
        if (msg.content.startsWith('__FILE_DATA__')) {
            const file = JSON.parse(msg.content.replace('__FILE_DATA__', ''));
            return (
                <Paper
                    variant="outlined"
                    onClick={() => window.api?.os?.openFile(file.path)}
                    sx={{
                        mt: 1, p: 1.5, display: 'flex', alignItems: 'center', gap: 2,
                        bgcolor: 'rgba(0,0,0,0.3)', cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)', borderColor: 'primary.main' }
                    }}
                >
                    <Avatar sx={{ bgcolor: file.type === 'file' ? 'warning.dark' : 'info.dark', width: 32, height: 32 }}>
                        {file.type === 'file' ? <AttachFileIcon sx={{ fontSize: 18 }} /> : <DescriptionIcon sx={{ fontSize: 18 }} />}
                    </Avatar>
                    <Box sx={{ overflow: 'hidden' }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold', color: 'primary.light', textTransform: 'uppercase', fontSize: '9px' }}>
                            {file.type === 'file' ? 'EXTERNAL_ATTACHMENT' : 'PROJECT_DOCUMENT_LINK'}
                        </Typography>
                        <Typography variant="body2" noWrap sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                            {file.name}
                        </Typography>
                    </Box>
                </Paper>
            );
        }

        // Standard Text with Mentions
        const parts = msg.content.split(/(@\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                const taggedUser = part.slice(1).toLowerCase();
                const isMe = currentUser?.username?.toLowerCase() === taggedUser;
                return (
                    <Box component="span" key={i} sx={{ color: isMe ? 'warning.main' : 'info.main', fontWeight: 'bold', bgcolor: isMe ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)', px: 0.5, borderRadius: 0.5 }}>
                        {part}
                    </Box>
                );
            }
            return part;
        });
    };

    const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', borderRadius: 2, overflow: 'hidden' }}>

            {/* 1. HEADER */}
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.3)' }}>
                {projectId ? (
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'primary.main' }}>
                            // PROJECT_COMMLINK
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Chip label="ENCRYPTED" size="small" sx={{ fontSize: '9px', height: 16, opacity: 0.6 }} />
                            {/* 🔥 CLOSE BUTTON FOR PROJECT VIEW (If passed) */}
                            {onClose && (
                                <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    </Box>
                ) : (
                    // 🔥 CLOSE BUTTON FOR GLOBAL VIEW
                    <Box display="flex" alignItems="center">
                        <Tabs value={viewMode === 'dm_chat' ? 'dm_list' : viewMode} onChange={(e, v) => setViewMode(v)} variant="fullWidth" sx={{ flexGrow: 1 }}>
                            <Tab value="global" label="GLOBAL" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }} />
                            <Tab value="dm_list" label="DIRECT MESSAGES" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }} />
                        </Tabs>

                        {onClose && (
                            <IconButton onClick={onClose} sx={{ mr: 1, ml: 1, color: 'text.secondary' }}>
                                <CloseIcon />
                            </IconButton>
                        )}
                    </Box>
                )}
            </Box>

            {/* 2. CHAT AREA */}
            {viewMode === 'dm_list' ? (
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                    <List>{dmStaffList.map(user => (
                        <ListItem key={user.id} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton onClick={() => setViewMode('dm_chat') || setSelectedDmUser(user)} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <ListItemAvatar><Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>{user.name.charAt(0)}</Avatar></ListItemAvatar>
                                <ListItemText primary={user.name} secondary={user.designation} primaryTypographyProps={{ sx: { fontSize: '13px', fontWeight: 'bold' } }} />
                            </ListItemButton>
                        </ListItem>
                    ))}</List>
                </Box>
            ) : (
                <>
                    {viewMode === 'dm_chat' && (
                        <Box sx={{ p: 1, display: 'flex', alignItems: 'center', bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                            <IconButton onClick={() => setViewMode('dm_list')}><ArrowBackIcon fontSize="small" /></IconButton>
                            <Typography sx={{ ml: 1, fontSize: '12px', fontWeight: 'bold' }}>DM: {selectedDmUser?.name}</Typography>
                        </Box>
                    )}
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {messages.map((msg) => {
                            const isMe = msg.senderId === currentUser?.id;
                            const sender = orgStaff.find(s => s.id === msg.senderId);
                            return (
                                <Box key={msg.id} sx={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 1.5, alignItems: 'flex-end' }}>
                                    {!isMe && <Avatar sx={{ width: 28, height: 28 }}>{sender?.name?.charAt(0)}</Avatar>}
                                    <Box sx={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: isMe ? 'primary.main' : 'rgba(255,255,255,0.05)', color: '#fff' }}>
                                            {renderMessageContent(msg)}
                                        </Box>
                                        <Typography variant="caption" sx={{ mt: 0.5, fontSize: '9px', color: 'text.secondary' }}>{formatTime(msg.createdAt)}</Typography>
                                    </Box>
                                </Box>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </Box>
                </>
            )}

            {/* 3. INPUT AREA */}
            {viewMode !== 'dm_list' && (
                <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.3)', position: 'relative' }}>

                    {/* MENTION SUGGESTIONS */}
                    {mentionSearch !== null && (
                        <Paper sx={{ position: 'absolute', bottom: '100%', left: 16, width: 250, maxHeight: 200, overflowY: 'auto', zIndex: 10, border: '1px solid', borderColor: 'primary.main' }}>
                            <List dense>{orgStaff.filter(s => s.username?.toLowerCase().includes(mentionSearch)).map(u => (
                                <ListItemButton key={u.id} onClick={() => handleMentionSelect(u.username)}>
                                    <ListItemText primary={u.name} secondary={`@${u.username}`} />
                                </ListItemButton>
                            ))}</List>
                        </Paper>
                    )}

                    <Box display="flex" gap={1}>
                        {/* 🔥 ATTACHMENT MENU */}
                        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="primary" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                            <AttachFileIcon fontSize="small" />
                        </IconButton>

                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileAttach} />

                        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                            <MenuItem onClick={() => fileInputRef.current.click()} sx={{ gap: 2 }}>
                                <FolderOpenIcon fontSize="small" color="primary" /> Upload New File
                            </MenuItem>
                            {projectId && <Divider />}
                            {projectId && <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', opacity: 0.5 }}>LINK PROJECT DOCS</Typography>}
                            {projectId && projectDocs.slice(0, 5).map(doc => (
                                <MenuItem key={doc.id} onClick={() => handleLinkExistingDoc(doc)} sx={{ gap: 2 }}>
                                    <InsertDriveFileIcon fontSize="small" color="info" /> {doc.name}
                                </MenuItem>
                            ))}
                        </Menu>

                        <TextField
                            fullWidth size="small" inputRef={inputRef}
                            placeholder="Type message... (@ for staff)"
                            value={input} onChange={handleInputChange}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' } }}
                        />
                        <IconButton color="primary" onClick={handleSend}><SendIcon fontSize="small" /></IconButton>
                    </Box>
                </Box>
            )}
        </Paper>
    );
}