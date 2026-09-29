"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Save,
  User,
} from "lucide-react";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userId, setUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(false);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("nina_profiles")
      .select("name,username,bio,avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setMessageOk(false);
    }

    if (data) {
      setName(data.name || "");
      setUsername(data.username || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
    }

    setLoading(false);
  }

  async function uploadAvatar(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || !userId) return;

    setMessage("");
    setMessageOk(false);

    if (!file.type.startsWith("image/")) {
      setMessage("Faqat rasm faylini tanlang.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Avatar 5 MB dan katta bo'lmasligi kerak.");
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);

    try {
      // Har bir user uchun bitta doimiy avatar fayli.
      // Yangi rasm eski avatarni almashtiradi.
      const storagePath = `${userId}/avatar`;

      const { error: uploadError } =
        await supabase.storage
          .from("nina-avatars")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } =
        supabase.storage
          .from("nina-avatars")
          .getPublicUrl(storagePath);

      // URL bir xil qoladi, shuning uchun cache'ni yangilash
      // uchun versiya qo'shamiz.
      const newAvatarUrl =
        `${publicData.publicUrl}?v=${Date.now()}`;

      const { error: profileError } =
        await supabase
          .from("nina_profiles")
          .update({
            avatar_url: newAvatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(newAvatarUrl);
      setMessage("Profil rasmi yangilandi.");
      setMessageOk(true);
    } catch (error) {
      console.error("AVATAR ERROR:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Avatar yuklanmadi."
      );

      setMessageOk(false);
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function saveProfile() {
    if (!userId || saving) return;

    setMessage("");
    setMessageOk(false);

    const cleanName = name.trim();

    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/g, "");

    const cleanBio = bio.trim();

    if (!cleanName) {
      setMessage("Ismingizni kiriting.");
      return;
    }

    if (cleanName.length > 50) {
      setMessage("Ism 50 ta belgidan oshmasin.");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage(
        "Username kamida 3 ta belgidan iborat bo'lsin."
      );
      return;
    }

    if (cleanUsername.length > 30) {
      setMessage(
        "Username 30 ta belgidan oshmasin."
      );
      return;
    }

    if (cleanBio.length > 120) {
      setMessage("Bio 120 ta belgidan oshmasin.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("nina_profiles")
      .upsert(
        {
          id: userId,
          name: cleanName,
          username: cleanUsername,
          bio: cleanBio,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    setSaving(false);

    if (error) {
      const errorText = error.message.toLowerCase();

      if (
        errorText.includes("duplicate") ||
        errorText.includes("unique")
      ) {
        setMessage(
          "Bu username band. Boshqasini tanlang."
        );
      } else {
        setMessage(error.message);
      }

      setMessageOk(false);
      return;
    }

    setName(cleanName);
    setUsername(cleanUsername);
    setBio(cleanBio);

    setMessage("Profil saqlandi ✓");
    setMessageOk(true);

    setTimeout(() => {
      window.location.href = "/chat";
    }, 600);
  }

  function getInitial() {
    const value =
      name.trim() ||
      username.trim() ||
      "N";

    return value.charAt(0).toUpperCase();
  }

  if (loading) {
    return (
      <main style={styles.center}>
        <div style={styles.loadingBox}>
          <Loader2
            size={30}
            style={{
              animation: "spin 1s linear infinite",
            }}
          />

          <span>NINA yuklanmoqda...</span>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.center}>
      <div style={styles.card}>
        <div style={styles.topBar}>
          <button
            type="button"
            style={styles.iconButton}
            onClick={() => {
              window.location.href = "/chat";
            }}
            title="Chatga qaytish"
          >
            <ArrowLeft size={22} />
          </button>

          <div style={styles.brand}>
            <div style={styles.brandLogo}>N</div>

            <div>
              <div style={styles.brandName}>NINA</div>
              <div style={styles.brandSub}>
                Profil sozlamalari
              </div>
            </div>
          </div>

          <div style={{ width: 44 }} />
        </div>

        <div style={styles.avatarSection}>
          <div style={styles.avatarWrapper}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profil rasmi"
                style={styles.avatarImage}
              />
            ) : (
              <div style={styles.avatarFallback}>
                {getInitial()}
              </div>
            )}

            <button
              type="button"
              style={styles.cameraButton}
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploadingAvatar}
              title="Profil rasmini almashtirish"
            >
              {uploadingAvatar ? (
                <Loader2
                  size={19}
                  style={{
                    animation: "spin 1s linear infinite",
                  }}
                />
              ) : (
                <Camera size={19} />
              )}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={uploadAvatar}
            style={{ display: "none" }}
          />

          <div style={styles.avatarTitle}>
            {name || "NINA foydalanuvchisi"}
          </div>

          <div style={styles.avatarUsername}>
            {username ? `@${username}` : "Username yo'q"}
          </div>

          <button
            type="button"
            style={styles.changePhotoButton}
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={uploadingAvatar}
          >
            {uploadingAvatar
              ? "Yuklanmoqda..."
              : avatarUrl
                ? "Rasmni almashtirish"
                : "Profil rasmi qo'shish"}
          </button>
        </div>

        <div style={styles.divider} />

        <label style={styles.label}>
          <User size={16} />
          Ism
        </label>

        <input
          style={styles.input}
          value={name}
          maxLength={50}
          onChange={(event) =>
            setName(event.target.value)
          }
          placeholder="Masalan: Suxrob"
        />

        <label style={styles.label}>
          Username
        </label>

        <div style={styles.usernameBox}>
          <span style={styles.at}>@</span>

          <input
            style={styles.usernameInput}
            value={username}
            maxLength={30}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="rakhimov"
          />
        </div>

        <div style={styles.hint}>
          Faqat a-z, 0-9 va _ ishlatiladi.
        </div>

        <label style={styles.label}>
          Bio
        </label>

        <textarea
          style={styles.textarea}
          value={bio}
          onChange={(event) =>
            setBio(event.target.value)
          }
          placeholder="O'zingiz haqingizda..."
          maxLength={120}
        />

        <div style={styles.counter}>
          {bio.length}/120
        </div>

        {message && (
          <div
            style={{
              ...styles.message,
              ...(messageOk
                ? styles.successMessage
                : styles.errorMessage),
            }}
          >
            {message}
          </div>
        )}

        <button
          type="button"
          style={{
            ...styles.saveButton,
            opacity:
              saving || uploadingAvatar ? 0.65 : 1,
          }}
          onClick={saveProfile}
          disabled={saving || uploadingAvatar}
        >
          {saving ? (
            <>
              <Loader2
                size={19}
                style={{
                  animation: "spin 1s linear infinite",
                }}
              />
              Saqlanmoqda...
            </>
          ) : (
            <>
              <Save size={19} />
              Profilni saqlash
            </>
          )}
        </button>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        * {
          box-sizing: border-box;
        }

        button,
        input,
        textarea {
          font-family: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </main>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  center: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -10%, #22285a 0%, #0c1220 38%, #050810 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    color: "white",
  },

  card: {
    width: "100%",
    maxWidth: 540,
    background: "rgba(12, 18, 32, 0.88)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 32,
    padding: 28,
    boxShadow:
      "0 30px 100px rgba(0,0,0,0.55)",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.055)",
    color: "#dceaf6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 15,
    background: "linear-gradient(135deg, #25baff 0%, #635cff 48%, #b64ee7 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 900,
  },

  brandName: {
    fontSize: 18,
    fontWeight: 800,
  },

  brandSub: {
    color: "#8594ad",
    fontSize: 12,
    marginTop: 2,
  },

  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  avatarWrapper: {
    width: 126,
    height: 126,
    position: "relative",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    objectFit: "cover",
    border: "4px solid rgba(255,255,255,0.10)",
    background: "#0b111e",
  },

  avatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    background:
      "linear-gradient(135deg, #25baff, #635cff 50%, #b64ee7)",
    border: "4px solid rgba(255,255,255,0.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 46,
    fontWeight: 900,
  },

  cameraButton: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 40,
    height: 40,
    borderRadius: 34,
    border: "3px solid #0c1220",
    background: "linear-gradient(135deg, #25baff 0%, #635cff 48%, #b64ee7 100%)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: 800,
    textAlign: "center",
  },

  avatarUsername: {
    marginTop: 4,
    color: "#8998b0",
    fontSize: 14,
  },

  changePhotoButton: {
    marginTop: 12,
    border: "none",
    background: "transparent",
    color: "#8d8cff",
    fontSize: 14,
    fontWeight: 700,
  },

  divider: {
    height: 1,
    background: "rgba(255,255,255,0.07)",
    margin: "25px 0 6px",
  },

  label: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#b8c2d4",
    marginBottom: 8,
    marginTop: 18,
    fontSize: 14,
    fontWeight: 700,
  },

  input: {
    width: "100%",
    padding: "15px 17px",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0b111e",
    color: "white",
    outline: "none",
    fontSize: 16,
  },

  usernameBox: {
    display: "flex",
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0b111e",
    borderRadius: 15,
    overflow: "hidden",
  },

  at: {
    paddingLeft: 17,
    color: "#8b7cff",
    fontSize: 18,
    fontWeight: 800,
  },

  usernameInput: {
    width: "100%",
    padding: "15px 17px 15px 5px",
    border: "none",
    background: "transparent",
    color: "white",
    outline: "none",
    fontSize: 16,
  },

  hint: {
    color: "#66758e",
    fontSize: 12,
    marginTop: 7,
    paddingLeft: 4,
  },

  textarea: {
    width: "100%",
    minHeight: 105,
    resize: "vertical",
    padding: "15px 17px",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0b111e",
    color: "white",
    outline: "none",
    fontSize: 15,
    lineHeight: 1.5,
  },

  counter: {
    textAlign: "right",
    color: "#718099",
    fontSize: 12,
    marginTop: 6,
  },

  message: {
    marginTop: 17,
    borderRadius: 13,
    padding: "12px 14px",
    fontSize: 14,
  },

  successMessage: {
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(34, 197, 94, 0.25)",
    color: "#8ce8aa",
  },

  errorMessage: {
    background: "rgba(239, 68, 68, 0.10)",
    border: "1px solid rgba(239, 68, 68, 0.22)",
    color: "#ffaaaa",
  },

  saveButton: {
    width: "100%",
    marginTop: 20,
    padding: 15,
    border: "none",
    borderRadius: 15,
    background: "linear-gradient(135deg, #25baff 0%, #635cff 48%, #b64ee7 100%)",
    color: "white",
    fontWeight: 800,
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  loadingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    color: "#9aa8bd",
    fontSize: 16,
  },
};


