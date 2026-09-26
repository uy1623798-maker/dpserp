import './SchoolGallery.css';

const duplicateShots = new Set([7, 9, 10, 15, 27, 35, 36, 38, 39, 42]);
const photos = Array.from({length: 62}, (_, index) => index + 1)
  .filter(number => !duplicateShots.has(number))
  .map(number => ({
    src: `/gallery/school-${String(number).padStart(3, '0')}.jpeg`,
    number,
  }));

export default function SchoolGallery() {
  return <>
    <section className="pagehero">
      <span className="kicker lighttxt">Dhumari Public School · Gallery</span>
      <h1>Moments that shape memories.</h1>
      <p>A glimpse of learning, achievement, teamwork and joy at Dhumari Public School.</p>
    </section>
    <section className="pagebody" aria-label="School photo gallery">
      <p>Moments from our school. Select a photo to view it full size.</p>
      <div className="school-photo-grid">
        {photos.map(({src, number}) => <a key={src} href={src} target="_blank" rel="noopener noreferrer" aria-label={`View school photo ${number} full size (opens a new tab)`}>
          <img src={src} alt={`Dhumari Public School gallery photo ${number}`} loading="lazy" decoding="async" />
        </a>)}
      </div>
    </section>
  </>;
}
