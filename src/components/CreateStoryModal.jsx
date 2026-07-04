import React, { useState, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { isSupabaseConfigured, supabase } from '../supabaseClient';
import { X, Sparkles, Upload, FileImage } from 'lucide-react';

export default function CreateStoryModal() {
  const {
    currentUser,
    isCreateStoryOpen,
    setIsCreateStoryOpen,
    publishStory
  } = useChat();

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  if (!currentUser) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        handleFileSelect(file);
      } else {
        alert("Пожалуйста, загрузите файл изображения!");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (file) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const uploadImageToSupabase = async (file) => {
    if (isSupabaseConfigured) {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${currentUser.id}/story_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      return publicUrl;
    } else {
      // In mock mode, the FileReader loaded preview is already Base64
      return imagePreview;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      alert("Пожалуйста, выберите изображение для истории!");
      return;
    }

    setIsSubmitting(true);
    try {
      const mediaUrl = await uploadImageToSupabase(imageFile);
      const story = await publishStory(mediaUrl, caption.trim());
      if (story) {
        // Reset states
        setCaption('');
        setImageFile(null);
        setImagePreview('');
        setIsCreateStoryOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert(`Ошибка при загрузке: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCaption('');
    setImageFile(null);
    setImagePreview('');
    setIsCreateStoryOpen(false);
  };

  return (
    <div className={`settings-modal-overlay ${isCreateStoryOpen ? 'open' : ''}`}>
      <div className="new-chat-container story-create-modal">
        {/* Header */}
        <div className="settings-header">
          <h3>Создать историю</h3>
          <button className="settings-close-btn" onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="new-chat-body story-form">
          <div className="story-layout">
            
            {/* Story Live Preview */}
            <div className="story-preview-container">
              <span className="section-title-label">Предпросмотр</span>
              <div 
                className="story-preview-card" 
                style={{ 
                  backgroundImage: imagePreview ? `url(${imagePreview})` : 'none',
                  backgroundColor: '#121922' 
                }}
              >
                <div className="story-preview-overlay-bg" />
                
                <div className="story-preview-header">
                  <div className="story-preview-avatar">🪙</div>
                  <div className="story-preview-meta">
                    <span className="story-preview-user">Вы</span>
                    <span className="story-preview-time">Только что</span>
                  </div>
                </div>

                {!imagePreview && (
                  <div className="story-preview-placeholder">
                    <FileImage size={40} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Изображение не выбрано</span>
                  </div>
                )}

                <div className="story-preview-caption-box">
                  <p className="story-preview-caption-text">
                    {caption.trim() || 'Ваша подпись будет здесь...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Form Settings */}
            <div className="story-settings-panel">
              
              {/* File Dropzone Area */}
              <div className="form-group">
                <label className="settings-section-title">Загрузите изображение истории</label>
                <div 
                  className={`file-dropzone ${dragActive ? 'drag-active' : ''} ${imageFile ? 'has-file' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="file-upload-input-hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'none' }}
                  />
                  
                  <Upload size={28} className="dropzone-icon" />
                  {imageFile ? (
                    <div className="dropzone-text-group">
                      <span className="dropzone-filename">{imageFile.name}</span>
                      <span className="dropzone-filesize">({(imageFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="dropzone-text-group">
                      <span className="dropzone-title">Выберите файл изображения</span>
                      <span className="dropzone-subtitle">или перетащите его сюда</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Caption input */}
              <div className="form-group">
                <label htmlFor="story-caption" className="settings-section-title">Подпись</label>
                <textarea
                  id="story-caption"
                  className="story-caption-textarea"
                  maxLength={150}
                  placeholder="Добавьте захватывающую подпись к вашей истории..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <span className="char-counter">{caption.length}/150</span>
              </div>

              {/* Actions */}
              <button
                type="submit"
                disabled={isSubmitting || !imageFile}
                className="btn-primary auth-submit-btn"
                style={{ marginTop: '10px' }}
              >
                {isSubmitting ? (
                  <div className="spinner" style={{ margin: '0 auto', width: '20px', height: '20px', borderColor: '#ffffff', borderTopColor: 'rgba(255,255,255,0.3)' }} />
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Опубликовать историю</span>
                  </>
                )}
              </button>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
