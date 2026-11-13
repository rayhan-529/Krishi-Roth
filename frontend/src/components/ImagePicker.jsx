/**
 * Choose up to `max` photos, preview them, and tick existing photos to remove.
 */
import { useEffect, useMemo } from 'react'
import { useLang } from '../context/LanguageContext'
import { mediaUrl } from '../services/api'
import Icon from './Icon'

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 3

export default function ImagePicker({ files, onFiles, existing = [], removeIds = [], onToggleRemove, max = 5, onError }) {
  const { tr } = useLang()
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const kept = existing.filter((img) => !removeIds.includes(img.id)).length
  const room = max - kept - files.length

  function choose(event) {
    const chosen = Array.from(event.target.files || [])
    event.target.value = ''
    const valid = chosen.filter((f) => TYPES.includes(f.type) && f.size <= MAX_MB * 1024 * 1024)
    if (valid.length < chosen.length && onError) {
      onError(tr(`শুধু JPG, PNG বা WEBP ছবি (${MAX_MB} MB পর্যন্ত) দেওয়া যাবে।`, `Only JPG, PNG or WEBP photos up to ${MAX_MB} MB are allowed.`))
    }
    onFiles([...files, ...valid].slice(0, max - kept))
  }

  return (
    <div className="image-picker">
      <div className="image-grid">
        {existing.map((img) => {
          const removing = removeIds.includes(img.id)
          return (
            <div key={img.id} className={`image-tile ${removing ? 'removing' : ''}`}>
              <img src={mediaUrl(img.image_path)} alt="" />
              <button type="button" onClick={() => onToggleRemove(img.id)} className="tile-btn">
                {removing ? tr('রাখুন', 'Keep') : <Icon name="trash" size={16} />}
              </button>
            </div>
          )
        })}
        {previews.map((p, index) => (
          <div key={p.url} className="image-tile new">
            <img src={p.url} alt="" />
            <button type="button" className="tile-btn" onClick={() => onFiles(files.filter((_, i) => i !== index))} aria-label={tr('সরান', 'Remove')}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        {room > 0 && (
          <label className="image-add">
            <Icon name="upload" size={26} />
            <span>{tr('ছবি যোগ করুন', 'Add photos')}</span>
            <small>{tr(`আরও ${room}টি`, `${room} more`)}</small>
            <input type="file" accept={TYPES.join(',')} multiple onChange={choose} hidden />
          </label>
        )}
      </div>
    </div>
  )
}
