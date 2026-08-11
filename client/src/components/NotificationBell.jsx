import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AppContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { notificationAPI } from "../services/api.js";
import "./NotificationBell.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const SOCKET_URL = API_BASE.replace(/\/api$/, "");

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      socket.emit("join_room", user._id);
    });

    socket.on("notification", (notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    return () => {
      socket.off("connect");
      socket.off("notification");
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const response = await notificationAPI.getNotifications();
        setNotifications(response.notifications || []);
      } catch (err) {
        console.error("Failed to load notifications", err);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((note) => !note.read).length,
    [notifications]
  );

  const togglePanel = () => {
    setIsOpen((prev) => !prev);
  };

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications((prev) => prev.map((note) => (note._id === id ? { ...note, read: true } : note)));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(notifications.filter((note) => !note.read).map((note) => notificationAPI.markAsRead(note._id)));
      setNotifications((prev) => prev.map((note) => ({ ...note, read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  return (
    <div className="notification-bell-wrapper">
      <button className="notification-bell-button" onClick={togglePanel} type="button">
        🔔
        {unreadCount > 0 && <span className="notification-bell-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div className="notification-panel-title">{t("notifications")}</div>
            <button className="notification-panel-action" onClick={markAllRead} type="button">
              {t("markAllRead")}
            </button>
          </div>

          <div className="notification-panel-body">
            {loading && <div className="notification-loading">{t("loading")}</div>}
            {!loading && notifications.length === 0 && <div className="notification-empty">{t("noNotifications")}</div>}
            {!loading && notifications.map((note) => (
              <div key={note._id} className={`notification-item ${note.read ? "read" : "unread"}`}>
                <div className="notification-item-top">
                  <div className="notification-item-title">{note.title}</div>
                  {!note.read && (
                    <button
                      className="notification-mark-read"
                      onClick={() => markAsRead(note._id)}
                      type="button"
                    >
                      {t("markRead")}
                    </button>
                  )}
                </div>
                <div className="notification-item-message">{note.message}</div>
                <div className="notification-item-meta">
                  {note.type} • {new Date(note.createdAt || note.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
