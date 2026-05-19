function ImageLightbox({ image, onClose }) {
  if (!image?.src) return null;

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-4" onClick={onClose}>
    <div className="relative max-h-[92vh] w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
      <button onClick={onClose} className="absolute right-0 top-0 z-10 rounded-full bg-white/90 px-3 py-1 text-sm text-slate-700 shadow">Close</button>
      <img src={image.src} alt={image.alt || "Uploaded image"} className="mx-auto max-h-[92vh] w-full rounded-2xl object-contain" />
    </div>
  </div>;
}

export { ImageLightbox };
