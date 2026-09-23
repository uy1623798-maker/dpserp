import './SchoolGallery.css';

const photos = Array.from({length: 51}, (_, index) => ({
  src: `/gallery/school-${String(index + 1).padStart(3, '0')}.jpeg`,
  number: index + 1,
}));

export default function SchoolGallery() {
  return <>
    <section className="pagehero">
      <span className="kicker lighttxt">Dhumari Public School · Gallery</span>
      <h1>Moments that shape memories.</h1>
      <p>A glimpse of learning, achievement, teamwork and joy at Dhumari Public School.</p>
    </section>
    <section className="pagebody" aria-label="School photo gallery">
      <p>51 moments from our school. Select a photo to view it full size.</p>
      <div className="school-photo-grid">
        {photos.map(({src, number}) => <a key={src} href={src} target="_blank" rel="noopener noreferrer" aria-label={`View school photo ${number} full size (opens a new tab)`}>
          <img src={src} alt={`Dhumari Public School gallery photo ${number}`} loading="lazy" decoding="async" />
        </a>)}
      </div>
    </section>
  </>;
}
