import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, TextField, IconButton, Avatar, Paper,
    Tabs, Tab, List, ListItem, ListItemAvatar, ListItemText, ListItemButton
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Import Auth to know who is sending the message
import { useAuth } from '../../context/AuthContext';

export default function ChatModule({ projectId = null, orgStaff = [] }) {
    const { currentUser } = useAuth();

    // UI State
    // Modes: 'project' (default if projectId exists), 'global' (channel), 'dm_list' (directory), 'dm_chat' (1-on-1)
    const [viewMode, setViewMode] = useState(projectId ? 'project' : 'global');
    const [selectedDmUser, setSelectedDmUser] = useState(null);

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);

    // Filter out the current user from the DM list
    const dmStaffList = orgStaff.filter(s => s.id !== currentUser?.id);

    const loadMessages = async () => {
        try {
            if (viewMode === 'project' || viewMode === 'global') {
                const data = await window.api.db.getMessages(projectId);
                setMessages(data || []);
            } else if (viewMode === 'dm_chat' && selectedDmUser) {
                const data = await window.api.db.getPrivateMessages(currentUser.id, selectedDmUser.id);
                setMessages(data || []);
            }
            scrollToBottom();
        } catch (error) {
            console.error("Failed to load messages:", error);
        }
    };

    useEffect(() => {
        loadMessages();
        // Poll for new messages every 3 seconds
        const interval = setInterval(loadMessages, 3000);
        return () => clearInterval(interval);
    }, [projectId, viewMode, selectedDmUser]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        if (viewMode === 'dm_chat' && selectedDmUser) {
            // Send Private Message
            const newPm = {
                id: crypto.randomUUID(),
                senderId: currentUser.id,
                receiverId: selectedDmUser.id,
                content: input.trim(),
                createdAt: Date.now()
            };
            await window.api.db.savePrivateMessage(newPm);
        } else {
            // Send Public/Project Message
            const newMsg = {
                id: crypto.randomUUID(),
                projectId: projectId, // Will be null for global
                senderId: currentUser.id,
                content: input.trim(),
                createdAt: Date.now()
            };
            await window.api.db.saveMessage(newMsg);
        }

        setInput("");
        loadMessages();
    };

    const openDmChat = (user) => {
        setSelectedDmUser(user);
        setViewMode('dm_chat');
        setMessages([]); // Clear chat immediately before fetching new ones
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // --- RENDER HELPERS ---
    const renderChatWindow = (chatTitle) => (
        <>
            {/* SUB-HEADER (For DMs) */}
            {viewMode === 'dm_chat' && (
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton size="small" onClick={() => setViewMode('dm_list')} sx={{ color: 'primary.main' }}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '10px' }}>
                        {selectedDmUser?.name?.charAt(0)}
                    </Avatar>
                    <Typography variant="subtitle2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 'bold' }}>
                        {chatTitle}
                    </Typography>
                </Box>
            )}

            {/* MESSAGE WINDOW */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {messages.length === 0 && (
                    <Typography sx={{ textAlign: 'center', mt: 5, color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        No messages yet. Start the conversation.
                    </Typography>
                )}

                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser?.id;
                    const sender = orgStaff.find(s => s.id === msg.senderId);

                    return (
                        <Box key={msg.id} sx={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 1.5, alignItems: 'flex-end' }}>
                            {!isMe && (
                                <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
                                    {sender?.name?.charAt(0) || '?'}
                                </Avatar>
                            )}

                            <Box sx={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                {!isMe && viewMode !== 'dm_chat' && (
                                    <Typography variant="caption" sx={{ ml: 1, mb: 0.5, fontSize: '10px', color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>
                                        {sender?.name || 'Unknown User'}
                                    </Typography>
                                )}

                                <Box sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    borderBottomLeftRadius: isMe ? 2 : 0,
                                    borderBottomRightRadius: isMe ? 0 : 2,
                                    bgcolor: isMe ? 'primary.main' : 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    border: isMe ? 'none' : '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', wordBreak: 'break-word' }}>
                                        {msg.content}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ mt: 0.5, fontSize: '9px', color: 'text.secondary', fontFamily: "'JetBrains Mono', monospace" }}>
                                    {formatTime(msg.createdAt)}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
                <div ref={messagesEndRef} />
            </Box>

            {/* INPUT AREA */}
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.3)', display: 'flex', gap: 1 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Transmit message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') handleSend(); }}
                    InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', bgcolor: 'rgba(0,0,0,0.4)' } }}
                />
                <IconButton color="primary" onClick={handleSend} sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                    <SendIcon fontSize="small" />
                </IconButton>
            </Box>
        </>
    );

    return (
        <Paper sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400, maxHeight: '100%', border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(13, 31, 60, 0.5)', borderRadius: 2 }}>

            {/* HEADER: If no Project ID, show Global vs DM Tabs */}
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.3)' }}>
                {projectId ? (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 'bold', color: 'primary.main' }}>
                            // PROJECT_COMMLINK
                        </Typography>
                    </Box>
                ) : (
                    <Tabs
                        value={viewMode === 'dm_chat' ? 'dm_list' : viewMode}
                        onChange={(e, v) => setViewMode(v)}
                        variant="fullWidth"
                        indicatorColor="primary"
                        textColor="primary"
                    >
                        <Tab value="global" label="GLOBAL CHANNEL" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 'bold' }} />
                        <Tab value="dm_list" label="DIRECT MESSAGES" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 'bold' }} />
                    </Tabs>
                )}
            </Box>

            {/* ROUTER */}
            {(viewMode === 'project' || viewMode === 'global') && renderChatWindow()}

            {viewMode === 'dm_chat' && renderChatWindow(`Encrypted DM: ${selectedDmUser?.name}`)}

            {viewMode === 'dm_list' && (
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                    <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", color: 'text.secondary', display: 'block', mb: 2 }}>
                        SELECT PERSONNEL
                    </Typography>
                    <List sx={{ width: '100%' }}>
                        {dmStaffList.map(user => (
                            <ListItem key={user.id} disablePadding sx={{ mb: 1 }}>
                                <ListItemButton
                                    onClick={() => openDmChat(user)}
                                    sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)', borderColor: 'primary.main' } }}
                                >
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32, fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
                                            {user.name.charAt(0)}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 'bold' }}>{user.name}</Typography>}
                                        secondary={<Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'text.secondary' }}>{user.designation}</Typography>}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

        </Paper>
    );
}