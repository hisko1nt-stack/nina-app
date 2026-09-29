"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Search, Send, LogOut, MessageCircle, Paperclip, FileText, Loader2, Mic, Square, MoreVertical, Pencil, Trash2, X, Check, Reply, ArrowLeft, Copy, Pin, Archive, ArchiveRestore, Bell, BellOff } from "lucide-react";

type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: string | null;
};

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  read_at: string | null;
  edited_at: string | null;
  reply_to_id: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
};

type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type ChatItem = {
  chat_id: string;
  person: Profile;
  last_message: string;
  last_time: string;
  unread_count: number;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  muted_until: string | null;
};

export default function ChatPage() {
  const [userId, setUserId] = useState("");
  const [me, setMe] = useState<Profile | null>(null);

  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [muteMenuChat, setMuteMenuChat] = useState<ChatItem | null>(null);
  const mutedChatsRef = useRef<Map<string, string | null>>(new Map());
  const [selected, setSelected] = useState<Profile | null>(null);
  const [chatId, setChatId] = useState("");
  const [profileViewOpen, setProfileViewOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);

  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchIndex, setMessageSearchIndex] = useState(0);

  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [typingUserName, setTypingUserName] = useState("");

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationAudioRef = useRef<AudioContext | null>(null);
  const originalTitleRef = useRef("NINA");

  const activeChatIdRef = useRef("");
  const chatsRef = useRef<ChatItem[]>([]);
  const peopleRef = useRef<Profile[]>([]);

  const loadChatsTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeChatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    init();

    return () => {
      if (notificationAudioRef.current) {
        notificationAudioRef.current.close().catch(() => {});
        notificationAudioRef.current = null;
      }
    };
  }, []);

  function updateDocumentTitle(unread: number) {
    if (typeof document === "undefined") return;

    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title || "NINA";
    }

    document.title =
      unread > 0
        ? `NINA (${unread})`
        : originalTitleRef.current;
  }

  function playNotificationSound() {
    try {
      if (typeof window === "undefined") return;

      const AudioCtx =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioCtx) return;

      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new AudioCtx();
      }

      const ctx = notificationAudioRef.current;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(
        1174,
        ctx.currentTime + 0.08
      );

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.08,
        ctx.currentTime + 0.01
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.18
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (error) {
      console.warn("NOTIFICATION SOUND ERROR:", error);
    }
  }

  async function requestNotifications() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      setNotificationPermission("unsupported");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      return;
    }

    if (Notification.permission === "denied") {
      setNotificationPermission("denied");

      alert(
        "Bildirishnomalar brauzerda bloklangan. Sayt sozlamalaridan Notifications ruxsatini yoqing."
      );

      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      setNotificationPermission(permission);

      if (permission === "granted") {
        playNotificationSound();
      }
    } catch (error) {
      console.warn(
        "NOTIFICATION PERMISSION ERROR:",
        error
      );
    }
  }

  async function showMessageNotification(message: Message) {
    if (message.sender_id === userId) return;

    const mutedUntil =
      mutedChatsRef.current.get(message.chat_id);

    if (mutedChatsRef.current.has(message.chat_id)) {
      const muteIsActive =
        mutedUntil === null ||
        (typeof mutedUntil === "string" &&
          new Date(mutedUntil).getTime() > Date.now());

      if (muteIsActive) {
        return;
      }

      // Mute muddati tugagan bo'lsa lokal cache'dan chiqaramiz.
      mutedChatsRef.current.delete(message.chat_id);

      setChats((old) =>
        old.map((item) =>
          item.chat_id === message.chat_id
            ? {
                ...item,
                muted: false,
                muted_until: null,
              }
            : item
        )
      );
    }

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      activeChatIdRef.current === message.chat_id
    ) {
      return;
    }

    playNotificationSound();

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      let senderName = "NINA";
      let senderAvatar: string | undefined = undefined;

      const cachedSender =
        chatsRef.current.find(
          (item) =>
            item.person.id === message.sender_id
        )?.person ||
        peopleRef.current.find(
          (person) =>
            person.id === message.sender_id
        );

      if (cachedSender) {
        senderName =
          cachedSender.name ||
          cachedSender.username ||
          "NINA";

        senderAvatar =
          cachedSender.avatar_url ||
          undefined;
      } else {
        const { data: senderProfile, error: senderError } =
          await supabase
            .from("nina_profiles")
            .select("name,username,avatar_url")
            .eq("id", message.sender_id)
            .maybeSingle();

        if (senderError) {
          console.warn(
            "NOTIFICATION SENDER ERROR:",
            senderError
          );
        }

        if (senderProfile) {
          senderName =
            senderProfile.name ||
            senderProfile.username ||
            "NINA";

          senderAvatar =
            senderProfile.avatar_url ||
            undefined;
        }
      }

      const body =
        message.message_type === "image"
          ? "📷 Rasm yubordi"
          : message.message_type === "video"
            ? "🎬 Video yubordi"
            : message.message_type === "audio"
              ? "🎤 Ovozli xabar yubordi"
              : message.message_type === "file"
                ? `📎 ${message.file_name || "Fayl"}`
                : message.content || "Yangi xabar";

      const notification = new Notification(
        senderName,
        {
          body,
          icon: senderAvatar,
          tag: `nina-chat-${message.chat_id}`,
        }
      );

      notification.onclick = () => {
        window.focus();
        notification.close();

        const targetChat =
          chatsRef.current.find(
            (item) =>
              item.chat_id === message.chat_id
          );

        if (targetChat) {
          setSelected(targetChat.person);
          setChatId(targetChat.chat_id);

          setReplyingTo(null);
          setMessageMenuId(null);
          setReactionPickerId(null);
          setEmojiPanelOpen(false);
          setMessageSearchOpen(false);
          setMessageSearchQuery("");
          setMessageSearchIndex(0);
          setTypingUserId(null);
          setTypingUserName("");
          setQuery("");
          setPeople([]);

          loadMessages(targetChat.chat_id);
        }
      };
    }
  }
  async function init() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    setUserId(user.id);

    await supabase
      .from("nina_profiles")
      .update({
        is_online: true,
        last_seen: new Date().toISOString(),
      })
      .eq("id", user.id);

    const { data: profile } = await supabase
      .from("nina_profiles")
      .select("id,name,username,bio,avatar_url,is_online,last_seen")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setMe(profile);
    }

    await loadChats(user.id);

    if (
      typeof window !== "undefined" &&
      "Notification" in window
    ) {
      setNotificationPermission(
        Notification.permission
      );
    } else {
      setNotificationPermission("unsupported");
    }
  }

  function scheduleLoadChats(uid: string) {
    if (!uid) return;

    if (loadChatsTimerRef.current) {
      clearTimeout(loadChatsTimerRef.current);
    }

    loadChatsTimerRef.current = setTimeout(() => {
      loadChatsTimerRef.current = null;
      void loadChats(uid);
    }, 180);
  }

  async function loadChats(uid: string) {
    const { data: myMemberships, error } = await supabase
      .from("nina_chat_members")
      .select("chat_id")
      .eq("user_id", uid);

    if (error) {
      console.error(error);
      return;
    }

    const ids = (myMemberships || []).map((x) => x.chat_id);

    if (!ids.length) {
      setChats([]);
      return;
    }

    const { data: otherMembers } = await supabase
      .from("nina_chat_members")
      .select("chat_id,user_id")
      .in("chat_id", ids)
      .neq("user_id", uid);

    if (!otherMembers?.length) {
      setChats([]);
      return;
    }

    const personIds = [
      ...new Set(otherMembers.map((x) => x.user_id)),
    ];

    const { data: profiles } = await supabase
      .from("nina_profiles")
      .select("id,name,username,bio,avatar_url,is_online,last_seen")
      .in("id", personIds);

    const { data: unreadRows, error: unreadError } =
      await supabase.rpc("nina_unread_counts");

    if (unreadError) {
      console.error("UNREAD ERROR:", unreadError);
    }

    const unreadMap = new Map<string, number>();

    const { data: pinnedRows, error: pinnedError } =
      await supabase
        .from("nina_pinned_chats")
        .select("chat_id")
        .eq("user_id", uid);

    if (pinnedError) {
      console.error("PIN LOAD ERROR:", pinnedError);
    }

    const pinnedSet = new Set(
      (pinnedRows || []).map((row) => row.chat_id)
    );

    const { data: archivedRows, error: archivedError } =
      await supabase
        .from("nina_archived_chats")
        .select("chat_id")
        .eq("user_id", uid);

    if (archivedError) {
      console.error("ARCHIVE LOAD ERROR:", archivedError);
    }

    const archivedSet = new Set(
      (archivedRows || []).map((row) => row.chat_id)
    );

    const { data: mutedRows, error: mutedError } =
      await supabase
        .from("nina_muted_chats")
        .select("chat_id,muted_until")
        .eq("user_id", uid);

    if (mutedError) {
      console.error("MUTE LOAD ERROR:", mutedError);
    }

    const now = Date.now();

    const activeMutedRows = (mutedRows || []).filter((row) => {
      if (!row.muted_until) return true;

      return new Date(row.muted_until).getTime() > now;
    });

    const mutedMap = new Map<string, string | null>(
      activeMutedRows.map((row) => [
        row.chat_id,
        row.muted_until,
      ])
    );

    mutedChatsRef.current = new Map(
      activeMutedRows.map((row) => [
        row.chat_id,
        row.muted_until,
      ])
    );

    for (const row of unreadRows || []) {
      unreadMap.set(
        row.chat_id,
        Number(row.unread_count || 0)
      );
    }

    // Barcha chatlarning xabarlarini bitta query bilan olamiz.
    // created_at DESC bo'lgani uchun har chatdan birinchi
    // uchragan xabar o'sha chatning eng oxirgi xabari bo'ladi.
    const { data: latestMessageRows, error: latestMessagesError } =
      await supabase
        .from("nina_messages")
        .select(
          "chat_id,content,created_at,message_type,file_name"
        )
        .in("chat_id", ids)
        .order("created_at", { ascending: false });

    if (latestMessagesError) {
      console.error(
        "LAST MESSAGES LOAD ERROR:",
        latestMessagesError
      );
    }

    const latestMessageMap = new Map<
      string,
      {
        content: string | null;
        created_at: string;
        message_type: string;
        file_name: string | null;
      }
    >();

    for (const message of latestMessageRows || []) {
      if (!latestMessageMap.has(message.chat_id)) {
        latestMessageMap.set(
          message.chat_id,
          message
        );
      }
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const result: ChatItem[] = [];

    for (const member of otherMembers) {
      const person =
        profileMap.get(member.user_id);

      if (!person) continue;

      const last =
        latestMessageMap.get(member.chat_id);

      result.push({
        chat_id: member.chat_id,
        person,
        last_message:
          last?.message_type === "image"
            ? "📷 Rasm"
            : last?.message_type === "video"
              ? "🎬 Video"
              : last?.message_type === "audio"
                ? "🎤 Ovozli xabar"
                : last?.message_type === "file"
                  ? `📎 ${last?.file_name || "Fayl"}`
                  : last?.content || "Yangi suhbat",
        last_time: last?.created_at || "",
        unread_count:
          unreadMap.get(member.chat_id) || 0,
        pinned: pinnedSet.has(member.chat_id),
        archived: archivedSet.has(member.chat_id),
        muted: mutedMap.has(member.chat_id),
        muted_until:
          mutedMap.get(member.chat_id) ?? null,
      });
    }

    result.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      const aa = a.last_time
        ? new Date(a.last_time).getTime()
        : 0;

      const bb = b.last_time
        ? new Date(b.last_time).getTime()
        : 0;

      return bb - aa;
    });

    setChats(result);
  }

  useEffect(() => {
    if (!query.trim() || !userId) {
      setPeople([]);
      return;
    }

    const timer = setTimeout(async () => {
      const q = query.trim();

      const { data } = await supabase
        .from("nina_profiles")
        .select("id,name,username,bio,avatar_url,is_online,last_seen")
        .neq("id", userId)
        .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(20);

      setPeople(data || []);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, userId]);

  async function refreshSelectedPresence(personId: string) {
    const { data, error } = await supabase
      .from("nina_profiles")
      .select("id,name,username,bio,avatar_url,is_online,last_seen")
      .eq("id", personId)
      .maybeSingle();

    if (error || !data) return;

    setSelected((old) =>
      old?.id === data.id ? data : old
    );
  }

  function getFilteredChats() {
    const q = query.trim().toLowerCase();

    const visibleChats = chats.filter(
      (item) => item.archived === archiveOpen
    );

    if (!q) return visibleChats;

    return visibleChats.filter((item) => {
      const name =
        item.person.name?.toLowerCase() || "";

      const username =
        item.person.username?.toLowerCase() || "";

      const lastMessage =
        item.last_message?.toLowerCase() || "";

      return (
        name.includes(q) ||
        username.includes(q) ||
        lastMessage.includes(q)
      );
    });
  }
  async function copyMessage(message: Message) {
    const value =
      message.content ||
      (message.message_type === "image"
        ? "📷 Rasm"
        : message.message_type === "video"
          ? "🎬 Video"
          : message.message_type === "audio"
            ? "🎤 Ovozli xabar"
            : message.message_type === "file"
              ? `📎 ${message.file_name || "Fayl"}`
              : "");

    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);

      setMessageMenuId(null);

      // Kichik tasdiq
      window.dispatchEvent(
        new CustomEvent("nina-copy-success")
      );
    } catch (error) {
      console.error("COPY ERROR:", error);

      alert("Xabarni nusxalab bo‘lmadi");
    }
  }
  function openSelectedProfile() {
    if (!selected) return;
    setProfileViewOpen(true);
    setMessageSearchOpen(false);
    setEmojiPanelOpen(false);
    setMessageMenuId(null);
    setReactionPickerId(null);
  }
  async function setChatMute(
    item: ChatItem,
    duration: "1h" | "8h" | "1d" | "forever"
  ) {
    if (!userId) return;

    let mutedUntil: string | null = null;

    if (duration !== "forever") {
      const hours =
        duration === "1h"
          ? 1
          : duration === "8h"
            ? 8
            : 24;

      mutedUntil = new Date(
        Date.now() + hours * 60 * 60 * 1000
      ).toISOString();
    }

    const { error } = await supabase
      .from("nina_muted_chats")
      .upsert(
        {
          user_id: userId,
          chat_id: item.chat_id,
          muted_until: mutedUntil,
        },
        {
          onConflict: "user_id,chat_id",
        }
      );

    if (error) {
      alert("Mute saqlanmadi: " + error.message);
      return;
    }

    mutedChatsRef.current.set(
      item.chat_id,
      mutedUntil
    );
    setMuteMenuChat(null);

    await loadChats(userId);
  }

  async function unmuteChat(item: ChatItem) {
    if (!userId) return;

    const { error } = await supabase
      .from("nina_muted_chats")
      .delete()
      .eq("user_id", userId)
      .eq("chat_id", item.chat_id);

    if (error) {
      alert("Mute o‘chirilmadi: " + error.message);
      return;
    }

    mutedChatsRef.current.delete(item.chat_id);
    setMuteMenuChat(null);

    await loadChats(userId);
  }

  function openMuteMenu(
    item: ChatItem,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();
    setMuteMenuChat(item);
  }
  async function toggleArchiveChat(
    item: ChatItem,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    if (!userId) return;

    if (item.archived) {
      const { error } = await supabase
        .from("nina_archived_chats")
        .delete()
        .eq("user_id", userId)
        .eq("chat_id", item.chat_id);

      if (error) {
        alert("Chat arxivdan chiqarilmadi: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("nina_archived_chats")
        .insert({
          user_id: userId,
          chat_id: item.chat_id,
        });

      if (error) {
        alert("Chat arxivlanmadi: " + error.message);
        return;
      }

      if (chatId === item.chat_id) {
        setSelected(null);
        setChatId("");
        setMessages([]);
        setReplyingTo(null);
        setMessageMenuId(null);
        setReactionPickerId(null);
      }
    }

    await loadChats(userId);
  }
  async function togglePinChat(
    item: ChatItem,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    if (!userId) return;

    if (item.pinned) {
      const { error } = await supabase
        .from("nina_pinned_chats")
        .delete()
        .eq("user_id", userId)
        .eq("chat_id", item.chat_id);

      if (error) {
        alert("Chat pindan olinmadi: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("nina_pinned_chats")
        .insert({
          user_id: userId,
          chat_id: item.chat_id,
        });

      if (error) {
        alert("Chat pin qilinmadi: " + error.message);
        return;
      }
    }

    await loadChats(userId);
  }
  async function selectExistingChat(item: ChatItem) {
    setSelected(item.person);
    setChatId(item.chat_id);
    setReplyingTo(null);
    setMessageMenuId(null);
    setReactionPickerId(null);
    setEmojiPanelOpen(false);
    setMessageSearchOpen(false);
    setTypingUserId(null);
    setTypingUserName("");
    setMessageSearchQuery("");
    setMessageSearchIndex(0);
    setQuery("");
    setPeople([]);

    await loadMessages(item.chat_id);
  }

  async function openChat(person: Profile) {
    if (!userId || person.id === userId) return;

    setSelected(person);
    setReplyingTo(null);
    setMessageMenuId(null);
    setReactionPickerId(null);
    setEmojiPanelOpen(false);
    setMessageSearchOpen(false);
    setMessageSearchQuery("");
    setMessageSearchIndex(0);
    setTypingUserId(null);
    setTypingUserName("");
    setPeople([]);
    setQuery("");

    // Avval lokal ro'yxatdan tekshiramiz.
    const existing = chatsRef.current.find(
      (item) => item.person.id === person.id
    );

    if (existing) {
      setChatId(existing.chat_id);
      await loadMessages(existing.chat_id);
      return;
    }

    // Supabase bitta joyda mavjud chatni topadi
    // yoki yangi direct chat yaratadi.
    const { data: directChatId, error } =
      await supabase.rpc(
        "nina_get_or_create_direct_chat",
        {
          other_user_id: person.id,
        }
      );

    if (error || !directChatId) {
      console.error(
        "DIRECT CHAT ERROR:",
        error
      );

      alert(
        error?.message ||
          "Chatni ochib bo'lmadi."
      );

      setSelected(null);
      return;
    }

    const nextChatId = String(directChatId);

    setChatId(nextChatId);

    await loadMessages(nextChatId);
    await loadChats(userId);
  }
  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior,
        block: "end",
      });
    }, 50);
  }

  useEffect(() => {
    if (!chatId) return;

    scrollToBottom("smooth");
  }, [messages.length, chatId]);
  async function loadMessages(id: string) {
    const { data, error } = await supabase
      .from("nina_messages")
      .select("*")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setMessages(data || []);
    scrollToBottom("auto");

    await loadReactions(id);
    await markAsRead(id);

    if (userId) {
      await loadChats(userId);
    }
  }

  async function loadReactions(id: string) {
    const { data: messageRows, error: messageError } =
      await supabase
        .from("nina_messages")
        .select("id")
        .eq("chat_id", id);

    if (messageError) {
      console.error(
        "REACTION MESSAGE LOAD ERROR:",
        messageError
      );
      setReactions([]);
      return;
    }

    const messageIds = (messageRows || []).map(
      (item) => item.id
    );

    if (!messageIds.length) {
      setReactions([]);
      return;
    }

    const { data, error } = await supabase
      .from("nina_message_reactions")
      .select("id,message_id,user_id,emoji,created_at")
      .in("message_id", messageIds);

    if (error) {
      console.error("REACTION LOAD ERROR:", error);
      setReactions([]);
      return;
    }

    setReactions(data || []);
  }

  async function toggleReaction(
    messageId: string,
    emoji: string
  ) {
    if (!userId) return;

    const existing = reactions.find(
      (reaction) =>
        reaction.message_id === messageId &&
        reaction.user_id === userId
    );

    if (existing?.emoji === emoji) {
      const { error } = await supabase
        .from("nina_message_reactions")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (error) {
        alert("Reaction o'chirilmadi: " + error.message);
        return;
      }

      setReactions((old) =>
        old.filter((reaction) => reaction.id !== existing.id)
      );

      setReactionPickerId(null);
      return;
    }

    if (existing) {
      const { data, error } = await supabase
        .from("nina_message_reactions")
        .update({
          emoji,
        })
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("id,message_id,user_id,emoji,created_at")
        .single();

      if (error) {
        alert("Reaction o'zgartirilmadi: " + error.message);
        return;
      }

      setReactions((old) =>
        old.map((reaction) =>
          reaction.id === existing.id
            ? data
            : reaction
        )
      );

      setReactionPickerId(null);
      return;
    }

    const { data, error } = await supabase
      .from("nina_message_reactions")
      .insert({
        message_id: messageId,
        user_id: userId,
        emoji,
      })
      .select("id,message_id,user_id,emoji,created_at")
      .single();

    if (error) {
      alert("Reaction qo'yilmadi: " + error.message);
      return;
    }

    setReactions((old) => [...old, data]);
    setReactionPickerId(null);
  }

  function getMessageReactions(messageId: string) {
    const rows = reactions.filter(
      (reaction) => reaction.message_id === messageId
    );

    const grouped = new Map<
      string,
      {
        emoji: string;
        count: number;
        mine: boolean;
      }
    >();

    for (const reaction of rows) {
      const current = grouped.get(reaction.emoji);

      if (current) {
        current.count += 1;

        if (reaction.user_id === userId) {
          current.mine = true;
        }
      } else {
        grouped.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          mine: reaction.user_id === userId,
        });
      }
    }

    return Array.from(grouped.values());
  }
  async function markAsRead(id: string) {
    if (!userId || !id) return;

    const { error } = await supabase.rpc(
      "nina_mark_chat_read",
      {
        target_chat_id: id,
      }
    );

    if (error) {
      console.error(
        "MARK CHAT READ ERROR:",
        error
      );
    }
  }

  useEffect(() => {
    if (!chatId || !userId) return;

    setTypingUserId(null);
    setTypingUserName("");

    const typingChannel = supabase.channel(
      `nina-typing-${chatId}`,
      {
        config: {
          broadcast: {
            self: false,
          },
        },
      }
    );

    typingChannelRef.current = typingChannel;

    typingChannel
      .on(
        "broadcast",
        { event: "typing" },
        (payload) => {
          const data = payload.payload as {
            userId?: string;
            name?: string;
            isTyping?: boolean;
          };

          if (!data || data.userId === userId) return;

          if (data.isTyping) {
            setTypingUserId(data.userId || null);
            setTypingUserName(
              data.name || "Foydalanuvchi"
            );
          } else {
            setTypingUserId(null);
            setTypingUserName("");
          }
        }
      )
      .subscribe();

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      typingChannelRef.current = null;
      setTypingUserId(null);
      setTypingUserName("");

      supabase.removeChannel(typingChannel);
    };
  }, [chatId, userId]);

  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = typingChannelRef.current;

    if (!channel) return;

    if (!text.trim() || recording) {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId,
          name:
            me?.name ||
            me?.username ||
            "Foydalanuvchi",
          isTyping: false,
        },
      });

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      return;
    }

    channel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId,
        name:
          me?.name ||
          me?.username ||
          "Foydalanuvchi",
        isTyping: true,
      },
    });

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId,
          name:
            me?.name ||
            me?.username ||
            "Foydalanuvchi",
          isTyping: false,
        },
      });

      typingTimerRef.current = null;
    }, 1400);

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [text, chatId, userId, recording, me?.name, me?.username]);
  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase
      .channel(`nina-chat-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nina_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const msg = payload.new as Message;

          setMessages((old) =>
            old.some((x) => x.id === msg.id)
              ? old
              : [...old, msg]
          );

          scheduleLoadChats(userId);

          if (msg.sender_id !== userId) {
            setTimeout(() => {
              markAsRead(chatId);
            }, 150);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "nina_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updated = payload.new as Message;

          setMessages((old) =>
            old.map((message) =>
              message.id === updated.id
                ? updated
                : message
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "nina_messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const deleted = payload.old as {
            id?: string;
          };

          if (deleted?.id) {
            setMessages((old) =>
              old.filter(
                (message) =>
                  message.id !== deleted.id
              )
            );
          } else {
            loadMessages(chatId);
          }

          scheduleLoadChats(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, userId]);

  useEffect(() => {
    if (!chatId || !userId) return;

    const syncReadStatus = async () => {
      const { data, error } = await supabase
        .from("nina_messages")
        .select("id,read_at")
        .eq("chat_id", chatId)
        .eq("sender_id", userId);

      if (error || !data) return;

      setMessages((old) =>
        old.map((message) => {
          const fresh = data.find(
            (row) => row.id === message.id
          );

          if (!fresh) return message;

          return {
            ...message,
            read_at: fresh.read_at,
          };
        })
      );
    };

    syncReadStatus();

    // Realtime asosiy usul.
    // Polling faqat zaxira sifatida har 15 soniyada ishlaydi.
    const timer = setInterval(
      syncReadStatus,
      15000
    );

    return () => {
      clearInterval(timer);
    };
  }, [chatId, userId]);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    const setOnline = async () => {
      if (!active) return;

      await supabase
        .from("nina_profiles")
        .update({
          is_online: true,
          last_seen: new Date().toISOString(),
        })
        .eq("id", userId);
    };

    const setOffline = async () => {
      await supabase
        .from("nina_profiles")
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
        })
        .eq("id", userId);
    };

    setOnline();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        setOnline();
      }
    }, 10000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setOnline();
      } else {
        setOffline();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      active = false;
      clearInterval(timer);

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      setOffline();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const presenceChannel = supabase
      .channel(`nina-presence-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "nina_profiles",
        },
        (payload) => {
          const profile = payload.new as Profile;

          setChats((old) =>
            old.map((item) =>
              item.person.id === profile.id
                ? {
                    ...item,
                    person: {
                      ...item.person,
                      ...profile,
                    },
                  }
                : item
            )
          );

          setPeople((old) =>
            old.map((person) =>
              person.id === profile.id
                ? {
                    ...person,
                    ...profile,
                  }
                : person
            )
          );

          setSelected((old) =>
            old?.id === profile.id
              ? {
                  ...old,
                  ...profile,
                }
              : old
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [userId]);
  useEffect(() => {
    if (!selected?.id) return;

    // Chat ochilganda bir marta aniq holatni olamiz.
    void refreshSelectedPresence(selected.id);

    // Asosiy yangilanish Realtime orqali keladi.
    // Polling faqat Realtime uzilib qolsa backup.
    const timer = setInterval(() => {
      void refreshSelectedPresence(selected.id);
    }, 30000);

    return () => {
      clearInterval(timer);
    };
  }, [selected?.id]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`nina-unread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nina_messages",
        },
        (payload) => {
          const msg = payload.new as Message;

          scheduleLoadChats(userId);

          if (msg.sender_id !== userId) {
            showMessageNotification(msg);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "nina_messages",
        },
        () => {
          scheduleLoadChats(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const unread = chats.reduce(
      (sum, item) => sum + item.unread_count,
      0
    );

    updateDocumentTitle(unread);
  }, [chats]);

  useEffect(() => {
    return () => {
      updateDocumentTitle(0);

      if (notificationAudioRef.current) {
        notificationAudioRef.current.close().catch(() => {});
        notificationAudioRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase
      .channel(`nina-reactions-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nina_message_reactions",
        },
        () => {
          loadReactions(chatId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "nina_message_reactions",
        },
        () => {
          loadReactions(chatId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "nina_message_reactions",
        },
        () => {
          loadReactions(chatId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, userId]);
  useEffect(() => {
    if (!recording) {
      setRecordSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setRecordSeconds((old) => old + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [recording]);

  function formatRecordTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  async function startVoiceRecording() {
    if (!userId || !chatId || uploading || recording) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      alert("Bu brauzer mikrofon orqali ovoz yozishni qo'llamaydi.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = "";

      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ) {
        mimeType = "audio/webm;codecs=opus";
      } else if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm")
      ) {
        mimeType = "audio/webm";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = audioChunksRef.current;

        const actualType =
          recorder.mimeType ||
          chunks[0]?.type ||
          "audio/webm";

        const blob = new Blob(chunks, {
          type: actualType,
        });

        mediaStreamRef.current?.getTracks().forEach((track) => {
          track.stop();
        });

        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];

        if (blob.size === 0) {
          alert("Ovoz yozilmadi.");
          return;
        }

        await uploadVoice(blob);
      };

      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error("MICROPHONE ERROR:", error);

      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      mediaStreamRef.current = null;

      alert(
        "Mikrofonga ruxsat berilmadi. Brauzerda mikrofon ruxsatini yoqing."
      );
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") return;

    setRecording(false);
    recorder.stop();
  }

  async function uploadVoice(blob: Blob) {
    if (!userId || !chatId) return;

    if (blob.size > 50 * 1024 * 1024) {
      alert("Ovozli xabar 50 MB dan katta.");
      return;
    }

    setUploading(true);

    try {
      const extension =
        blob.type.includes("ogg")
          ? "ogg"
          : blob.type.includes("mp4")
            ? "m4a"
            : "webm";

      const fileName = `voice-${Date.now()}.${extension}`;

      const storagePath =
        `${userId}/${chatId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("nina-chat-files")
        .upload(storagePath, blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: blob.type || "audio/webm",
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from("nina-chat-files")
        .getPublicUrl(storagePath);

      const { error: messageError } = await supabase
        .from("nina_messages")
        .insert({
          chat_id: chatId,
          sender_id: userId,
          message_type: "audio",
          content: "Ovozli xabar",
          file_url: publicData.publicUrl,
          file_name: fileName,
          file_size: blob.size,
          file_type: blob.type || "audio/webm",
          reply_to_id: replyingTo?.id || null,
        });

      if (messageError) {
        throw messageError;
      }

      setReplyingTo(null);
      await loadChats(userId);
    } catch (error) {
      console.error("VOICE UPLOAD ERROR:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Ovozli xabar yuborilmadi.";

      alert("Ovozli xabar yuborilmadi: " + message);
    } finally {
      setUploading(false);
    }
  }
  async function uploadFile(file: File) {
    if (!userId || !chatId || uploading) return;

    if (file.size > 50 * 1024 * 1024) {
      alert("Fayl 50 MB dan katta bo'lmasligi kerak.");
      return;
    }

    setUploading(true);

    try {
      const extension = file.name.includes(".")
        ? file.name.split(".").pop()
        : "file";

      const safeExtension = (extension || "file")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

      const storagePath =
        `${userId}/${chatId}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("nina-chat-files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from("nina-chat-files")
        .getPublicUrl(storagePath);

      const fileUrl = publicData.publicUrl;

      let messageType = "file";

      if (file.type.startsWith("image/")) {
        messageType = "image";
      } else if (file.type.startsWith("video/")) {
        messageType = "video";
      }

      const { error: messageError } = await supabase
        .from("nina_messages")
        .insert({
          chat_id: chatId,
          sender_id: userId,
          message_type: messageType,
          content: file.name,
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || "application/octet-stream",
          reply_to_id: replyingTo?.id || null,
        });

      if (messageError) {
        throw messageError;
      }

      setReplyingTo(null);
      await loadChats(userId);
    } catch (error) {
      console.error("FILE UPLOAD ERROR:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Fayl yuborishda xato yuz berdi.";

      alert("Fayl yuborilmadi: " + message);
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(size: number | null) {
    if (!size) return "";

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  function getReplyPreview(message: Message | undefined | null) {
    if (!message) {
      return "Xabar";
    }

    if (message.message_type === "image") {
      return "📷 Rasm";
    }

    if (message.message_type === "video") {
      return "🎬 Video";
    }

    if (message.message_type === "audio") {
      return "🎤 Ovozli xabar";
    }

    if (message.message_type === "file") {
      return `📎 ${message.file_name || "Fayl"}`;
    }

    return message.content || "Xabar";
  }

  function startReply(message: Message) {
    setReplyingTo(message);
    setMessageMenuId(null);
    setEditingMessageId(null);
    setEditText("");

    setTimeout(() => {
      const input = document.getElementById(
        "nina-message-input"
      ) as HTMLInputElement | null;

      input?.focus();
    }, 50);
  }

  function cancelReply() {
    setReplyingTo(null);
  }
  function startEditingMessage(message: Message) {
    if (
      message.sender_id !== userId ||
      message.message_type !== "text"
    ) {
      return;
    }

    setEditingMessageId(message.id);
    setEditText(message.content || "");
    setMessageMenuId(null);
  }

  function cancelEditingMessage() {
    setEditingMessageId(null);
    setEditText("");
  }

  async function saveEditedMessage(messageId: string) {
    const value = editText.trim();

    if (!value || !userId) return;

    const { error } = await supabase
      .from("nina_messages")
      .update({
        content: value,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .eq("sender_id", userId)
      .eq("message_type", "text");

    if (error) {
      alert("Xabar tahrirlanmadi: " + error.message);
      return;
    }

    setMessages((old) =>
      old.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: value,
              edited_at: new Date().toISOString(),
            }
          : message
      )
    );

    setEditingMessageId(null);
    setEditText("");

    await loadChats(userId);
  }

  async function deleteMessage(message: Message) {
    if (message.sender_id !== userId) return;

    const confirmed = window.confirm(
      "Bu xabarni o'chirmoqchimisiz?"
    );

    if (!confirmed) {
      setMessageMenuId(null);
      return;
    }

    const { error } = await supabase
      .from("nina_messages")
      .delete()
      .eq("id", message.id)
      .eq("sender_id", userId);

    if (error) {
      alert("Xabar o'chirilmadi: " + error.message);
      return;
    }

    setMessages((old) =>
      old.filter((item) => item.id !== message.id)
    );

    setMessageMenuId(null);

    await loadChats(userId);
  }
  function insertEmoji(emoji: string) {
    const input = messageInputRef.current;

    if (!input) {
      setText((old) => old + emoji);
      return;
    }

    const start =
      input.selectionStart ?? text.length;

    const end =
      input.selectionEnd ?? text.length;

    const nextText =
      text.slice(0, start) +
      emoji +
      text.slice(end);

    setText(nextText);

    const nextPosition =
      start + emoji.length;

    setTimeout(() => {
      input.focus();

      input.setSelectionRange(
        nextPosition,
        nextPosition
      );
    }, 0);
  }
  async function sendMessage() {
    const value = text.trim();

    if (!value || !userId || !chatId) return;

    setText("");
    setEmojiPanelOpen(false);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId,
        name:
          me?.name ||
          me?.username ||
          "Foydalanuvchi",
        isTyping: false,
      },
    });

    const { error } = await supabase
      .from("nina_messages")
      .insert({
        chat_id: chatId,
        sender_id: userId,
        message_type: "text",
        content: value,
        reply_to_id: replyingTo?.id || null,
      });

    if (error) {
      alert(error.message);
      setText(value);
      return;
    }

    setReplyingTo(null);

    await loadChats(userId);
  }

  async function logout() {
    if (userId) {
      const { error } = await supabase
        .from("nina_profiles")
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        console.error("OFFLINE UPDATE ERROR:", error);
        alert("Offline status xatosi: " + error.message);
        return;
      }
    }

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function isProfileOnline(profile: Profile | null) {
    if (
      !profile?.is_online ||
      !profile.last_seen
    ) {
      return false;
    }

    const lastSeenTime =
      new Date(profile.last_seen).getTime();

    if (Number.isNaN(lastSeenTime)) {
      return false;
    }

    return Date.now() - lastSeenTime < 20000;
  }

  function formatLastSeen(
    value: string | null,
    isOnline: boolean = false
  ) {
    if (isOnline) return "online";

    if (!value) return "offline";

    const date = new Date(value);

    return `oxirgi marta ${date.toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    })}`;
  }

  function getMessageSearchResults() {
    const q = messageSearchQuery.trim().toLowerCase();

    if (!q) return [];

    return messages.filter((message) => {
      const content = message.content || "";
      const fileName = message.file_name || "";

      return (
        content.toLowerCase().includes(q) ||
        fileName.toLowerCase().includes(q)
      );
    });
  }

  function openMessageSearch() {
    setMessageSearchOpen(true);
    setMessageSearchQuery("");
    setMessageSearchIndex(0);
    setEmojiPanelOpen(false);
    setMessageMenuId(null);
    setReactionPickerId(null);
  }

  function closeMessageSearch() {
    setMessageSearchOpen(false);
    setMessageSearchQuery("");
    setMessageSearchIndex(0);
  }

  function goToMessageSearchResult(direction: number) {
    const results = getMessageSearchResults();

    if (!results.length) return;

    setMessageSearchIndex((old) => {
      const next = old + direction;

      if (next < 0) return results.length - 1;
      if (next >= results.length) return 0;

      return next;
    });
  }

  useEffect(() => {
    const results = getMessageSearchResults();

    if (!results.length) return;

    const safeIndex = Math.min(
      messageSearchIndex,
      results.length - 1
    );

    const message = results[safeIndex];

    if (!message) return;

    setTimeout(() => {
      document
        .getElementById(`nina-message-${message.id}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  }, [
    messageSearchQuery,
    messageSearchIndex,
    messages,
  ]);
  function formatTime(value: string) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="h-[100dvh] bg-[#0b1520] text-white flex overflow-hidden">
      <aside
        className={`w-full md:w-[390px] md:max-w-[38vw] bg-[#172431] border-r border-[#263442] flex flex-col shrink-0 ${
          selected
            ? "hidden md:flex"
            : "flex"
        }`}
      >

        <div className="p-4 md:p-5 border-b border-[#263442] flex items-center gap-3 shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#3395e8] flex items-center justify-center font-bold text-xl">
            {(me?.name || me?.username || "N")[0].toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-bold truncate">
              {me?.name || me?.username || "NINA user"}
            </div>

            <div className="text-[#8fa8c1] truncate">
              @{me?.username || ""}
            </div>
          </div>

          <button
            type="button"
            onClick={requestNotifications}
            disabled={
              notificationPermission === "unsupported"
            }
            title={
              notificationPermission === "granted"
                ? "Bildirishnomalar yoqilgan"
                : notificationPermission === "denied"
                  ? "Bildirishnomalar bloklangan"
                  : notificationPermission === "unsupported"
                    ? "Brauzer bildirishnomani qo'llamaydi"
                    : "Bildirishnomalarni yoqish"
            }
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition ${
              notificationPermission === "granted"
                ? "bg-[#193b2a] text-[#49d17d]"
                : notificationPermission === "denied"
                  ? "bg-[#3b2024] text-[#ff7d86]"
                  : "text-[#8fa8c1] hover:text-white hover:bg-[#26394a]"
            }`}
          >
            {notificationPermission === "granted" ? (
              <Bell size={20} />
            ) : (
              <BellOff size={20} />
            )}

            {notificationPermission === "default" && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f5b942]" />
            )}
          </button>

          <button
            onClick={logout}
            title="Chiqish"
            className="p-2"
          >
            <LogOut className="text-[#8fa8c1]" />
          </button>
        </div>

        <div className="p-3 md:p-4 relative shrink-0">
          <div className="bg-[#253444] rounded-2xl px-4 flex items-center gap-3">
            <Search
              className="text-[#8fa8c1]"
              size={21}
            />

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder="Odam yoki chat qidirish..."
              className="w-full bg-transparent outline-none py-4 text-white placeholder:text-[#8fa8c1]"
            />
          </div>

          {people.length > 0 && (
            <div className="absolute left-4 right-4 top-[78px] z-30 bg-[#1d2b39] border border-[#314254] rounded-xl overflow-hidden shadow-2xl">
              {people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => openChat(person)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-[#26394a]"
                >
                  <div className="relative w-11 h-11 shrink-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-[#3395e8] flex items-center justify-center font-bold">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.name || person.username || "Profil"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (person.name ||
                          person.username ||
                          "N")[0].toUpperCase()
                      )}
                    </div>

                    {person.is_online &&
                      person.last_seen &&
                      Date.now() -
                        new Date(person.last_seen).getTime() <
                        20000 && (
                        <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-[#49d17d] border-2 border-[#1d2b39]" />
                      )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {person.name ||
                        person.username}
                    </div>

                    <div className="text-sm text-[#8fa8c1] truncate">
                      @{person.username}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 md:px-4 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setArchiveOpen((old) => !old);
              setQuery("");
              setPeople([]);
            }}
            className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition ${
              archiveOpen
                ? "bg-[#2b4053] text-white"
                : "text-[#9bb0c3] hover:bg-[#223242] hover:text-white"
            }`}
          >
            {archiveOpen ? (
              <ArrowLeft size={19} />
            ) : (
              <Archive size={19} />
            )}

            <span className="font-semibold">
              {archiveOpen
                ? "Chatlarga qaytish"
                : `Arxiv (${chats.filter((item) => item.archived).length})`}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {chats.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center px-7">
              <MessageCircle
                size={60}
                className="text-[#60788e] mb-4"
              />

              <div className="font-bold text-xl">
                Hali chat yo‘q
              </div>

              <div className="text-[#8fa8c1] mt-3">
                Username yoki ism orqali odam qidiring.
              </div>
            </div>
          ) : getFilteredChats().length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center px-7">
              <Search
                size={52}
                className="text-[#60788e] mb-4"
              />

              <div className="font-bold text-lg">
                Chat topilmadi
              </div>

              <div className="text-[#8fa8c1] mt-2">
                Boshqa ism, username yoki xabar yozib ko‘ring.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {getFilteredChats().map((item) => (
                <div
                  key={item.chat_id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    selectExistingChat(item)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      selectExistingChat(item);
                    }
                  }}
                  className={`w-full p-3 md:p-4 rounded-2xl flex items-center gap-3 text-left transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3395e8]/50 ${
                    chatId === item.chat_id
                      ? "bg-[#2b4053]"
                      : "hover:bg-[#223242]"
                  }`}
                >
                  <div className="relative w-12 h-12 shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[#3395e8] flex items-center justify-center font-bold">
                      {item.person.avatar_url ? (
                        <img
                          src={item.person.avatar_url}
                          alt={item.person.name || item.person.username || "Profil"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (item.person.name ||
                          item.person.username ||
                          "N")[0].toUpperCase()
                      )}
                    </div>

                    {isProfileOnline(item.person) && (
                        <span
                          className="absolute right-0 bottom-0 w-3.5 h-3.5 rounded-full bg-[#49d17d] border-2 border-[#172431]"
                          title="Online"
                        />
                      )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-bold truncate flex-1">
                        {item.person.name ||
                          item.person.username}
                      </div>

                      <div className={`text-xs ${
  item.unread_count > 0
    ? "text-[#49d17d] font-semibold"
    : "text-[#829bb2]"
}`}>
                        {formatTime(
                          item.last_time
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <div className={`text-sm truncate flex-1 ${
  item.unread_count > 0
    ? "text-white font-medium"
    : "text-[#8fa8c1]"
}`}>
                        {item.last_message}
                      </div>

                      {item.unread_count > 0 && (
                        <div
                          className="min-w-6 h-6 px-2 rounded-full bg-[#3395e8] text-white text-xs font-bold flex items-center justify-center shadow-lg"
                          title={`${item.unread_count} ta o‘qilmagan xabar`}
                        >
                          {item.unread_count > 99
                            ? "99+"
                            : item.unread_count}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(event) =>
                          openMuteMenu(item, event)
                        }
                        title={
                          item.muted
                            ? "Bildirishnomalar o‘chirilgan"
                            : "Bildirishnomani o‘chirish"
                        }
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ${
                          item.muted
                            ? "text-[#f5b942] bg-[#263b4d]"
                            : "text-[#71889d] hover:text-white hover:bg-[#263b4d]"
                        }`}
                      >
                        {item.muted ? (
                          <BellOff size={16} />
                        ) : (
                          <Bell size={16} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(event) =>
                          toggleArchiveChat(item, event)
                        }
                        title={
                          item.archived
                            ? "Arxivdan chiqarish"
                            : "Arxivlash"
                        }
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[#71889d] hover:text-white hover:bg-[#263b4d] transition"
                      >
                        {item.archived ? (
                          <ArchiveRestore size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(event) =>
                          togglePinChat(item, event)
                        }
                        title={
                          item.pinned
                            ? "Pindan olish"
                            : "Chatni pin qilish"
                        }
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ${
                          item.pinned
                            ? "text-[#49d17d] bg-[#263b4d]"
                            : "text-[#71889d] hover:text-white hover:bg-[#263b4d]"
                        }`}
                      >
                        <Pin
                          size={16}
                          className={
                            item.pinned
                              ? "fill-current"
                              : ""
                          }
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section
        className={`flex-1 min-w-0 flex flex-col ${
          selected
            ? "flex"
            : "hidden md:flex"
        }`}
      >
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-[#07101a] px-6 py-3 rounded-full text-[#a8c1d8]">
              Suhbatni tanlang
            </div>
          </div>
        ) : (
          <>
            <header className="h-[68px] md:h-[76px] border-b border-[#263442] flex items-center px-3 md:px-6 gap-2 md:gap-3 bg-[#111e2a] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setChatId("");
                  setMessages([]);
                  setReplyingTo(null);
                  setEmojiPanelOpen(false);
                  setMessageSearchOpen(false);
                  setMessageSearchQuery("");
                  setMessageSearchIndex(0);
                  setTypingUserId(null);
                  setTypingUserName("");
                }}
                className="md:hidden w-10 h-10 rounded-full hover:bg-[#223242] flex items-center justify-center shrink-0"
                title="Chatlar"
              >
                <ArrowLeft size={22} />
              </button>

              <button
                type="button"
                onClick={openSelectedProfile}
                title="Profilni ochish"
                className="relative w-10 h-10 md:w-11 md:h-11 rounded-full shrink-0 overflow-hidden hover:opacity-90 transition"
              >
                {selected.avatar_url ? (
                  <img
                    src={selected.avatar_url}
                    alt={selected.name || selected.username || "Profil"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#3395e8] flex items-center justify-center font-bold">
                    {(selected.name ||
                      selected.username ||
                      "N")[0].toUpperCase()}
                  </div>
                )}

                {selected.is_online &&
                  selected.last_seen &&
                  Date.now() -
                    new Date(selected.last_seen).getTime() <
                    20000 && (
                    <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-[#49d17d] border-2 border-[#111e2a]" />
                  )}
              </button>

              <button
                type="button"
                onClick={openSelectedProfile}
                className="min-w-0 flex-1 text-left hover:opacity-90 transition"
              >
                <div className="font-bold truncate">
                  {selected.name ||
                    selected.username}
                </div>

                <div
                  className={`text-sm ${
                    selected.is_online &&
                    selected.last_seen &&
                    Date.now() -
                      new Date(selected.last_seen).getTime() <
                      20000
                      ? "text-[#49d17d]"
                      : "text-[#8fa8c1]"
                  }`}
                >
                  {typingUserId
                    ? `${typingUserName || "Foydalanuvchi"} yozmoqda...`
                    : formatLastSeen(selected.last_seen, isProfileOnline(selected))}
                </div>

                {typingUserId && (
                  <div className="text-xs text-[#49d17d] mt-0.5 animate-pulse">
                    ● yozmoqda...
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={openMessageSearch}
                title="Xabarlardan qidirish"
                className="ml-auto w-10 h-10 rounded-full hover:bg-[#223242] flex items-center justify-center"
              >
                <Search size={21} className="text-[#8fa8c1]" />
              </button>
            </header>

            {messageSearchOpen && (
              <div className="border-b border-[#263442] bg-[#172431] px-2 md:px-4 py-2 md:py-3">
                <div className="flex items-center gap-2">
                  <Search
                    size={19}
                    className="text-[#8fa8c1] shrink-0"
                  />

                  <input
                    autoFocus
                    value={messageSearchQuery}
                    onChange={(e) => {
                      setMessageSearchQuery(e.target.value);
                      setMessageSearchIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        goToMessageSearchResult(
                          e.shiftKey ? -1 : 1
                        );
                      }

                      if (e.key === "Escape") {
                        closeMessageSearch();
                      }
                    }}
                    placeholder="Xabar qidiring..."
                    className="flex-1 bg-[#223242] rounded-xl px-4 py-2.5 outline-none text-white placeholder:text-[#8fa8c1]"
                  />

                  {messageSearchQuery.trim() && (
                    <div className="text-xs text-[#8fa8c1] whitespace-nowrap">
                      {getMessageSearchResults().length
                        ? `${messageSearchIndex + 1}/${getMessageSearchResults().length}`
                        : "Topilmadi"}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      goToMessageSearchResult(-1)
                    }
                    disabled={!getMessageSearchResults().length}
                    title="Oldingi natija"
                    className="w-9 h-9 rounded-full hover:bg-[#2b4053] disabled:opacity-30 flex items-center justify-center"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      goToMessageSearchResult(1)
                    }
                    disabled={!getMessageSearchResults().length}
                    title="Keyingi natija"
                    className="w-9 h-9 rounded-full hover:bg-[#2b4053] disabled:opacity-30 flex items-center justify-center"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    onClick={closeMessageSearch}
                    title="Qidiruvni yopish"
                    className="w-9 h-9 rounded-full hover:bg-[#2b4053] flex items-center justify-center"
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 md:p-6 space-y-2">
              {messages.map((message) => {
                const mine =
                  message.sender_id === userId;

                return (
                  <div
                    id={`nina-message-${message.id}`}
                    key={message.id}
                    className={`flex ${
                      mine
                        ? "justify-end"
                        : "justify-start"
                    } ${
                      getMessageSearchResults().some(
                        (item) => item.id === message.id
                      ) &&
                      getMessageSearchResults()[
                        messageSearchIndex
                      ]?.id === message.id
                        ? "rounded-2xl ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#0b1520]"
                        : ""
                    }`}
                  >
                    <div
                      className={`relative max-w-[88%] sm:max-w-[80%] md:max-w-[70%] px-3 md:px-4 py-2 rounded-2xl ${
                        mine
                          ? "bg-[#3395e8] rounded-br-md"
                          : "bg-[#223242] rounded-bl-md"
                      }`}
                    >
                      {!mine && editingMessageId !== message.id && (
                        <div className="absolute -right-2 md:-right-20 -top-9 md:top-1 flex gap-1 z-30">
                          <button
                            type="button"
                            onClick={() =>
                              setReactionPickerId((old) =>
                                old === message.id
                                  ? null
                                  : message.id
                              )
                            }
                            title="Reaction"
                            className="w-8 h-8 rounded-full bg-[#172431] hover:bg-[#2b4053] flex items-center justify-center text-sm"
                          >
                            😊
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              startReply(message)
                            }
                            title="Javob berish"
                            className="w-8 h-8 rounded-full bg-[#172431] hover:bg-[#2b4053] flex items-center justify-center"
                          >
                            <Reply size={16} />
                          </button>
                        </div>
                      )}

                      {mine && editingMessageId !== message.id && (
                        <div className="absolute -left-2 md:-left-20 -top-9 md:top-1 flex gap-1 z-30">
                          <button
                            type="button"
                            onClick={() =>
                              setReactionPickerId((old) =>
                                old === message.id
                                  ? null
                                  : message.id
                              )
                            }
                            title="Reaction"
                            className="w-8 h-8 rounded-full bg-[#172431] hover:bg-[#2b4053] flex items-center justify-center text-sm"
                          >
                            😊
                          </button>

                          <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setMessageMenuId((old) =>
                                old === message.id
                                  ? null
                                  : message.id
                              )
                            }
                            title="Xabar amallari"
                            className="w-8 h-8 rounded-full bg-[#172431] hover:bg-[#2b4053] flex items-center justify-center"
                          >
                            <MoreVertical size={17} />
                          </button>

                          {messageMenuId === message.id && (
                            <div className="absolute right-8 top-0 z-50 w-44 bg-[#1d2b39] border border-[#314254] rounded-xl overflow-hidden shadow-2xl">
                              <button
                                type="button"
                                onClick={() =>
                                  startReply(message)
                                }
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#26394a] text-left"
                              >
                                <Reply size={17} />
                                <span>Javob berish</span>
                              </button>

                              {message.message_type === "text" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    startEditingMessage(message)
                                  }
                                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#26394a] text-left"
                                >
                                  <Pencil size={17} />
                                  <span>Tahrirlash</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  copyMessage(message)
                                }
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#26394a] text-left"
                              >
                                <Copy size={17} />
                                <span>Nusxalash</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteMessage(message)
                                }
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#26394a] text-left text-red-400"
                              >
                                <Trash2 size={17} />
                                <span>O'chirish</span>
                              </button>
                            </div>
                          )}
                          </div>
                        </div>
                      )}

                      {reactionPickerId === message.id && (
                        <div
                          className={`absolute top-10 z-50 flex items-center gap-1 bg-[#111e2a] border border-[#314254] rounded-full px-2 py-2 shadow-2xl ${
                            mine
                              ? "right-0"
                              : "left-0"
                          }`}
                        >
                          {["❤️", "👍", "😂", "🔥", "😮", "😢"].map(
                            (emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                  toggleReaction(
                                    message.id,
                                    emoji
                                  )
                                }
                                className="w-9 h-9 rounded-full hover:bg-[#2b4053] flex items-center justify-center text-xl hover:scale-110 transition"
                              >
                                {emoji}
                              </button>
                            )
                          )}
                        </div>
                      )}

                      {message.reply_to_id && (() => {
                        const repliedMessage = messages.find(
                          (item) =>
                            item.id === message.reply_to_id
                        );

                        return (
                          <div className="mb-2 rounded-lg bg-black/20 border-l-2 border-white/60 px-3 py-2">
                            <div className="text-[11px] font-bold opacity-80 mb-1">
                              {repliedMessage?.sender_id === userId
                                ? "Siz"
                                : selected?.name ||
                                  selected?.username ||
                                  "Foydalanuvchi"}
                            </div>

                            <div className="text-xs opacity-75 truncate max-w-[280px]">
                              {repliedMessage
                                ? getReplyPreview(repliedMessage)
                                : "Xabar o'chirilgan"}
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        {message.message_type === "image" && message.file_url ? (
                          <a
                            href={message.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            <img
                              src={message.file_url}
                              alt={message.file_name || "Rasm"}
                              className="max-w-[320px] max-h-[360px] rounded-xl object-cover"
                            />

                            {message.file_name && (
                              <div className="text-xs opacity-70 mt-2 break-all">
                                {message.file_name}
                              </div>
                            )}
                          </a>
                        ) : message.message_type === "video" &&
                          message.file_url ? (
                          <div>
                            <video
                              src={message.file_url}
                              controls
                              preload="metadata"
                              className="max-w-[360px] max-h-[360px] rounded-xl"
                            />

                            {message.file_name && (
                              <div className="text-xs opacity-70 mt-2 break-all">
                                {message.file_name}
                              </div>
                            )}
                          </div>
                        ) : message.message_type === "audio" &&
                          message.file_url ? (
                          <div className="min-w-[260px]">
                            <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                              <Mic size={17} />
                              <span>Ovozli xabar</span>
                            </div>

                            <audio
                              src={message.file_url}
                              controls
                              preload="metadata"
                              className="w-[280px] max-w-full"
                            />
                          </div>
                        ) : message.message_type === "file" &&
                          message.file_url ? (
                          <a
                            href={message.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 min-w-[220px]"
                          >
                            <div className="w-11 h-11 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                              <FileText size={23} />
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold break-all">
                                {message.file_name || "Fayl"}
                              </div>

                              <div className="text-xs opacity-70 mt-1">
                                {formatFileSize(message.file_size)}
                              </div>
                            </div>
                          </a>
                        ) : editingMessageId === message.id ? (
                          <div className="min-w-[280px]">
                            <textarea
                              autoFocus
                              value={editText}
                              onChange={(e) =>
                                setEditText(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  !e.shiftKey
                                ) {
                                  e.preventDefault();
                                  saveEditedMessage(message.id);
                                }

                                if (e.key === "Escape") {
                                  cancelEditingMessage();
                                }
                              }}
                              className="w-full min-h-[80px] bg-black/20 rounded-xl px-3 py-2 outline-none resize-none"
                            />

                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                type="button"
                                onClick={cancelEditingMessage}
                                title="Bekor qilish"
                                className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center"
                              >
                                <X size={18} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  saveEditedMessage(message.id)
                                }
                                disabled={!editText.trim()}
                                title="Saqlash"
                                className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center disabled:opacity-40"
                              >
                                <Check size={18} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        )}
                      </div>

                      {getMessageReactions(message.id).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {getMessageReactions(message.id).map(
                            (reaction) => (
                              <button
                                key={reaction.emoji}
                                type="button"
                                onClick={() =>
                                  toggleReaction(
                                    message.id,
                                    reaction.emoji
                                  )
                                }
                                className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 border ${
                                  reaction.mine
                                    ? "bg-white/20 border-white/40"
                                    : "bg-black/20 border-white/10"
                                }`}
                              >
                                <span>{reaction.emoji}</span>

                                <span>
                                  {reaction.count}
                                </span>
                              </button>
                            )
                          )}
                        </div>
                      )}

                      <div className="text-[11px] opacity-60 text-right mt-1">
                        {message.edited_at && (
                          <span className="mr-2">
                            tahrirlangan
                          </span>
                        )}

                        <span>
                          {formatTime(
                            message.created_at
                          )}
                        </span>

                        {mine && (
                          <span className="ml-1 font-bold">
                            {message.read_at
                              ? "✓✓"
                              : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div
                ref={messagesEndRef}
                className="h-px"
                aria-hidden="true"
              />
            </div>

            <div className="border-t border-[#263442] bg-[#111e2a] shrink-0">
              {replyingTo && (
                <div className="px-2 md:px-4 pt-2 md:pt-3">
                  <div className="bg-[#1b2a38] border-l-4 border-[#3395e8] rounded-xl px-4 py-3 flex items-center gap-3">
                    <Reply
                      size={20}
                      className="text-[#3395e8] shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#63b5f5]">
                        {replyingTo.sender_id === userId
                          ? "O'zingizga javob"
                          : `${
                              selected?.name ||
                              selected?.username ||
                              "Foydalanuvchi"
                            }ga javob`}
                      </div>

                      <div className="text-sm text-[#a8c1d8] truncate">
                        {getReplyPreview(replyingTo)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={cancelReply}
                      title="Javobni bekor qilish"
                      className="w-9 h-9 rounded-full hover:bg-[#2b4053] flex items-center justify-center shrink-0"
                    >
                      <X size={19} />
                    </button>
                  </div>
                </div>
              )}

              <div className="px-2 py-2 md:p-4 flex gap-2 md:gap-3 items-center">
              <input
                id="nina-file-input"
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    uploadFile(file);
                  }

                  e.currentTarget.value = "";
                }}
              />

              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  document
                    .getElementById("nina-file-input")
                    ?.click();
                }}
                title="Rasm, video yoki fayl yuborish"
                className="w-11 h-11 md:w-13 md:h-13 p-3 md:p-4 rounded-full bg-[#223242] hover:bg-[#2b4053] disabled:opacity-50 shrink-0"
              >
                {uploading ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <Paperclip size={22} />
                )}
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  disabled={recording}
                  onClick={() => {
                    setEmojiPanelOpen((old) => !old);
                    setReactionPickerId(null);
                    setMessageMenuId(null);
                  }}
                  title="Emoji"
                  className="w-11 h-11 md:w-13 md:h-13 p-2 md:p-3 rounded-full bg-[#223242] hover:bg-[#2b4053] disabled:opacity-50 flex items-center justify-center text-2xl"
                >
                  😀
                </button>

                {emojiPanelOpen && (
                  <div className="absolute bottom-14 left-0 md:left-0 z-[100] shadow-2xl max-w-[calc(100vw-24px)]">
                    <EmojiPicker
                      theme={Theme.DARK}
                      width={Math.min(360, window.innerWidth - 24)}
                      height={Math.min(440, window.innerHeight - 140)}
                      searchPlaceHolder="Emoji qidirish..."
                      previewConfig={{
                        showPreview: false,
                      }}
                      onEmojiClick={(emojiData) => {
                        insertEmoji(emojiData.emoji);
                      }}
                    />
                  </div>
                )}
              </div>

              <input
                ref={messageInputRef}
                id="nina-message-input"
                value={text}
                disabled={recording}
                onChange={(e) =>
                  setText(e.target.value)
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    sendMessage();
                  }
                }}
                placeholder="Xabar yozing..."
                className="flex-1 min-w-0 bg-[#223242] rounded-2xl px-3 md:px-5 h-11 md:h-13 outline-none text-sm md:text-base"
              />

              {recording ? (
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-red-400 min-w-[42px]">
                    {formatRecordTime(recordSeconds)}
                  </div>

                  <button
                    type="button"
                    onClick={stopVoiceRecording}
                    title="Ovoz yozishni tugatish"
                    className="w-11 h-11 md:w-13 md:h-13 p-3 md:p-4 rounded-full bg-red-500 hover:opacity-90 shrink-0"
                  >
                    <Square size={20} fill="currentColor" />
                  </button>
                </div>
              ) : text.trim() ? (
                <button
                  onClick={sendMessage}
                  disabled={uploading}
                  className="w-11 h-11 md:w-13 md:h-13 p-3 md:p-4 rounded-full bg-[#3395e8] hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  <Send size={22} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  disabled={uploading}
                  title="Ovozli xabar yozish"
                  className="w-11 h-11 md:w-13 md:h-13 p-3 md:p-4 rounded-full bg-[#3395e8] hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {uploading ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <Mic size={22} />
                  )}
                </button>
              )}
              </div>
            </div>
          </>
        )}
      </section>

      {profileViewOpen && selected && (
        <div
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setProfileViewOpen(false)}
        >
          <div
            className="w-full max-w-[390px] bg-[#172431] border border-[#314254] rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-28 bg-gradient-to-br from-[#3395e8] to-[#172431]">
              <button
                type="button"
                onClick={() => setProfileViewOpen(false)}
                className="absolute right-3 top-3 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center"
                title="Yopish"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pb-6">
              <div className="flex justify-center -mt-14">
                <div className="w-28 h-28 rounded-full border-4 border-[#172431] overflow-hidden bg-[#3395e8] flex items-center justify-center text-3xl font-bold">
                  {selected.avatar_url ? (
                    <img
                      src={selected.avatar_url}
                      alt={selected.name || selected.username || "Profil"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (selected.name ||
                      selected.username ||
                      "N")[0].toUpperCase()
                  )}
                </div>
              </div>

              <div className="text-center mt-4">
                <div className="text-2xl font-bold">
                  {selected.name ||
                    selected.username ||
                    "NINA user"}
                </div>

                <div className="text-[#8fa8c1] mt-1">
                  @{selected.username || ""}
                </div>

                {selected.bio?.trim() && (
                  <div className="mt-4 mx-auto max-w-[310px] rounded-2xl bg-[#111e2a] border border-[#2a3d4f] px-4 py-3 text-sm leading-6 text-[#d6e3ef] whitespace-pre-wrap break-words">
                    {selected.bio}
                  </div>
                )}

                <div
                  className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    selected.is_online &&
                    selected.last_seen &&
                    Date.now() -
                      new Date(selected.last_seen).getTime() <
                      20000
                      ? "bg-[#193b2a] text-[#49d17d]"
                      : "bg-[#223242] text-[#8fa8c1]"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      selected.is_online &&
                      selected.last_seen &&
                      Date.now() -
                        new Date(selected.last_seen).getTime() <
                        20000
                        ? "bg-[#49d17d]"
                        : "bg-[#60788e]"
                    }`}
                  />

                  {formatLastSeen(selected.last_seen, isProfileOnline(selected))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setProfileViewOpen(false)}
                  className="h-11 rounded-2xl bg-[#223242] hover:bg-[#2b4053] font-semibold"
                >
                  Yopish
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileViewOpen(false);
                    setTimeout(() => {
                      document
                        .getElementById("nina-message-input")
                        ?.focus();
                    }, 50);
                  }}
                  className="h-11 rounded-2xl bg-[#3395e8] hover:opacity-90 font-semibold"
                >
                  Xabar yozish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {muteMenuChat && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-3"
          onClick={() => setMuteMenuChat(null)}
        >
          <div
            className="w-full max-w-sm bg-[#172431] border border-[#314254] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#314254]">
              <div className="font-bold text-lg flex items-center gap-2">
                {muteMenuChat.muted ? (
                  <BellOff size={20} />
                ) : (
                  <Bell size={20} />
                )}

                Bildirishnomalar
              </div>

              <div className="text-sm text-[#8fa8c1] mt-1 truncate">
                {muteMenuChat.person.name ||
                  muteMenuChat.person.username}
              </div>
            </div>

            {muteMenuChat.muted && (
              <button
                type="button"
                onClick={() => unmuteChat(muteMenuChat)}
                className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#26394a] text-[#49d17d]"
              >
                <Bell size={19} />
                <span className="font-semibold">
                  Bildirishnomani yoqish
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setChatMute(muteMenuChat, "1h")
              }
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#26394a]"
            >
              <BellOff size={19} />
              <span>1 soatga o‘chirish</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setChatMute(muteMenuChat, "8h")
              }
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#26394a]"
            >
              <BellOff size={19} />
              <span>8 soatga o‘chirish</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setChatMute(muteMenuChat, "1d")
              }
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#26394a]"
            >
              <BellOff size={19} />
              <span>1 kunga o‘chirish</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setChatMute(muteMenuChat, "forever")
              }
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#26394a]"
            >
              <BellOff size={19} />
              <span>Doimiy o‘chirish</span>
            </button>

            <div className="p-3 border-t border-[#314254]">
              <button
                type="button"
                onClick={() => setMuteMenuChat(null)}
                className="w-full py-3 rounded-xl bg-[#223242] hover:bg-[#2b4053] font-semibold"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}














































