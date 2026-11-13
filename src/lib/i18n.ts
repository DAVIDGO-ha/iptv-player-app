// App language: English, Français, Deutsch, Español, Nederlands, Português, Italiano, Svenska, العربية.
// The whole interface is translated on screen (text, buttons, placeholders, tooltips) — channel, movie and
// series names from the playlist stay as they are.
import { getSettings, onSettings } from './settings'
import { country } from './bgflag'
import { D2, P2 } from './i18n-more'

export const LANGS: [string, string][] = [
  ['auto', 'Auto'],
  ['en', 'English'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['nl', 'Nederlands'],
  ['pt', 'Português'],
  ['it', 'Italiano'],
  ['sv', 'Svenska'],
  ['ar', 'العربية'],
]
type L = 'fr' | 'de' | 'es' | 'nl' | 'pt' | 'it' | 'sv' | 'ar'
const IDX: Record<L, number> = { fr: 0, de: 1, es: 2, nl: 0, pt: 1, it: 2, sv: 3, ar: 4 }
const MORE = new Set<L>(['nl', 'pt', 'it', 'sv', 'ar'])
const ALL = new Set<string>(['fr', 'de', 'es', 'nl', 'pt', 'it', 'sv', 'ar'])

// English → [French, German, Spanish]
const D: Record<string, [string, string, string]> = {
  // navigation / home
  'LIVE TV': ['TV EN DIRECT', 'LIVE-TV', 'TV EN VIVO'],
  MOVIES: ['FILMS', 'FILME', 'PELÍCULAS'],
  SERIES: ['SÉRIES', 'SERIEN', 'SERIES'],
  SPORTS: ['SPORTS', 'SPORT', 'DEPORTES'],
  Home: ['Accueil', 'Start', 'Inicio'],
  'Live TV': ['TV en direct', 'Live-TV', 'TV en vivo'],
  Movies: ['Films', 'Filme', 'Películas'],
  Movie: ['Film', 'Film', 'Película'],
  Series: ['Séries', 'Serien', 'Series'],
  Sports: ['Sports', 'Sport', 'Deportes'],
  'TV Guide': ['Guide TV', 'TV-Programm', 'Guía de TV'],
  Search: ['Rechercher', 'Suche', 'Buscar'],
  Favorites: ['Favoris', 'Favoriten', 'Favoritos'],
  Favorite: ['Favori', 'Favorit', 'Favorito'],
  Favorited: ['En favori', 'Favorisiert', 'En favoritos'],
  'Multi-View': ['Multi-écran', 'Multi-View', 'Multivista'],
  Settings: ['Paramètres', 'Einstellungen', 'Ajustes'],
  More: ['Plus', 'Mehr', 'Más'],
  Playlists: ['Playlists', 'Playlists', 'Listas'],
  Playlist: ['Playlist', 'Playlist', 'Lista'],
  'Watch History': ['Historique', 'Verlauf', 'Historial'],
  Record: ['Enregistrer', 'Aufnehmen', 'Grabar'],
  'Stop recording': ["Arrêter l'enregistrement", 'Aufnahme stoppen', 'Detener grabación'],
  Recordings: ['Enregistrements', 'Aufnahmen', 'Grabaciones'],
  'No recordings yet': ["Aucun enregistrement pour l'instant", 'Noch keine Aufnahmen', 'Aún no hay grabaciones'],
  'Open a live channel and press Record.': ['Ouvrez une chaîne en direct et appuyez sur Enregistrer.', 'Öffne einen Live-Sender und drücke Aufnehmen.', 'Abre un canal en directo y pulsa Grabar.'],
  'Open folder': ['Ouvrir le dossier', 'Ordner öffnen', 'Abrir carpeta'],
  'Recording saved — open Recordings to watch it': ['Enregistrement sauvegardé — ouvrez Enregistrements pour le regarder', 'Aufnahme gespeichert — unter Aufnahmen ansehen', 'Grabación guardada — ábrela en Grabaciones'],
  'Recording started. It uses one more connection of the line.': ["Enregistrement lancé. Il utilise une connexion de plus de la ligne.", 'Aufnahme gestartet. Sie nutzt eine weitere Verbindung der Leitung.', 'Grabación iniciada. Usa una conexión más de la línea.'],
  'Could not record this channel': ["Impossible d'enregistrer cette chaîne", 'Dieser Sender kann nicht aufgenommen werden', 'No se pudo grabar este canal'],
  'Recording is available in the Android, Firestick and computer apps.': ["L'enregistrement est disponible sur Android, Firestick et ordinateur.", 'Aufnahme gibt es in der Android-, Firestick- und Computer-App.', 'La grabación está disponible en Android, Firestick y ordenador.'],
  Stop: ['Arrêter', 'Stopp', 'Detener'],
  'Sure?': ['Sûr ?', 'Sicher?', '¿Seguro?'],
  'Account Info': ['Infos du compte', 'Kontoinfo', 'Información de la cuenta'],
  'Account info': ['Infos du compte', 'Kontoinfo', 'Información de la cuenta'],
  'My TV': ['Ma TV', 'Mein TV', 'Mi TV'],
  'My List': ['Ma liste', 'Meine Liste', 'Mi lista'],
  'In My List': ['Dans ma liste', 'In meiner Liste', 'En mi lista'],
  'What are you watching today?': ['Que regardez-vous aujourd’hui ?', 'Was schaust du heute?', '¿Qué vas a ver hoy?'],
  'Good afternoon': ['Bon après-midi', 'Guten Tag', 'Buenas tardes'],
  'Good evening': ['Bonsoir', 'Guten Abend', 'Buenas noches'],
  'Good morning': ['Bonjour', 'Guten Morgen', 'Buenos días'],
  'Continue Watching': ['Reprendre la lecture', 'Weiterschauen', 'Seguir viendo'],
  'Latest & Popular': ['Nouveautés & populaires', 'Neu & beliebt', 'Novedades y populares'],
  'Latest Series': ['Dernières séries', 'Neueste Serien', 'Últimas series'],
  'Recently Added': ['Ajoutés récemment', 'Neu hinzugefügt', 'Añadido recientemente'],
  'Recently Watched': ['Vus récemment', 'Zuletzt gesehen', 'Visto recientemente'],
  'Recently Watched Channels': ['Chaînes vues récemment', 'Zuletzt gesehene Sender', 'Canales vistos recientemente'],
  'Favorite Channels': ['Chaînes favorites', 'Lieblingssender', 'Canales favoritos'],
  'Top Rated': ['Les mieux notés', 'Top bewertet', 'Mejor valorados'],
  'See All': ['Tout voir', 'Alle anzeigen', 'Ver todo'],
  All: ['Tout', 'Alle', 'Todo'],
  'All Channels': ['Toutes les chaînes', 'Alle Sender', 'Todos los canales'],
  'All Sports': ['Tous les sports', 'Alle Sportarten', 'Todos los deportes'],
  'All Movies': ['Tous les films', 'Alle Filme', 'Todas las películas'],
  'All Series': ['Toutes les séries', 'Alle Serien', 'Todas las series'],
  Channels: ['Chaînes', 'Sender', 'Canales'],
  'Channels, movies and series': ['Chaînes, films et séries', 'Sender, Filme und Serien', 'Canales, películas y series'],
  'IPTV PLAYER home': ['Accueil IPTV PLAYER', 'IPTV PLAYER Start', 'Inicio IPTV PLAYER'],
  // lists / search
  'Search channels or number': ['Rechercher une chaîne ou un numéro', 'Sender oder Nummer suchen', 'Buscar canal o número'],
  'Search movies': ['Rechercher des films', 'Filme suchen', 'Buscar películas'],
  'Search series': ['Rechercher des séries', 'Serien suchen', 'Buscar series'],
  'Find anything': ['Tout rechercher', 'Alles finden', 'Buscar cualquier cosa'],
  Sort: ['Trier', 'Sortieren', 'Ordenar'],
  Number: ['Numéro', 'Nummer', 'Número'],
  Default: ['Par défaut', 'Standard', 'Predeterminado'],
  'A–Z': ['A–Z', 'A–Z', 'A–Z'],
  'Z–A': ['Z–A', 'Z–A', 'Z–A'],
  Newest: ['Plus récents', 'Neueste', 'Más recientes'],
  Rating: ['Note', 'Bewertung', 'Valoración'],
  'Select a channel': ['Choisissez une chaîne', 'Sender auswählen', 'Elige un canal'],
  'Choose a channel': ['Choisissez une chaîne', 'Sender auswählen', 'Elige un canal'],
  'Choose once to preview, again to watch full screen.': ['Un clic pour l’aperçu, un deuxième pour le plein écran.', 'Einmal für die Vorschau, nochmal für Vollbild.', 'Una vez para la vista previa, otra para pantalla completa.'],
  'Pick a movie': ['Choisissez un film', 'Wähle einen Film', 'Elige una película'],
  'Pick a series': ['Choisissez une série', 'Wähle eine Serie', 'Elige una serie'],
  'It plays right here — keep browsing while you watch. Use Full Screen any time.': ['La lecture se fait ici — continuez à naviguer. Plein écran à tout moment.', 'Läuft direkt hier — weiter stöbern beim Schauen. Vollbild jederzeit.', 'Se reproduce aquí — sigue navegando mientras ves. Pantalla completa cuando quieras.'],
  'Nothing here': ['Rien ici', 'Hier ist nichts', 'Nada por aquí'],
  'No channels': ['Aucune chaîne', 'Keine Sender', 'Sin canales'],
  'No live channels': ['Aucune chaîne en direct', 'Keine Live-Sender', 'Sin canales en vivo'],
  'No favorite channels yet': ['Pas encore de chaînes favorites', 'Noch keine Lieblingssender', 'Aún no hay canales favoritos'],
  'No favorites yet': ['Pas encore de favoris', 'Noch keine Favoriten', 'Aún no hay favoritos'],
  'No categories': ['Aucune catégorie', 'Keine Kategorien', 'Sin categorías'],
  'No sports categories found': ['Aucune catégorie sport trouvée', 'Keine Sportkategorien gefunden', 'No se encontraron categorías de deportes'],
  'Nothing watched yet': ['Rien regardé pour l’instant', 'Noch nichts angesehen', 'Aún no has visto nada'],
  'This playlist doesn’t include live TV.': ['Cette playlist ne contient pas de TV en direct.', 'Diese Playlist enthält kein Live-TV.', 'Esta lista no incluye TV en vivo.'],
  'Right-click or long-press a channel to add it.': ['Clic droit ou appui long sur une chaîne pour l’ajouter.', 'Rechtsklick oder lange drücken, um einen Sender hinzuzufügen.', 'Clic derecho o mantén pulsado un canal para añadirlo.'],
  'Add titles to My List to see them here.': ['Ajoutez des titres à Ma liste pour les voir ici.', 'Füge Titel zu Meiner Liste hinzu, um sie hier zu sehen.', 'Añade títulos a Mi lista para verlos aquí.'],
  'Tap the heart or “My List” on anything you love.': ['Touchez le cœur ou « Ma liste » sur ce que vous aimez.', 'Tippe auf das Herz oder „Meine Liste“.', 'Toca el corazón o «Mi lista» en lo que te guste.'],
  'Type at least two letters to search your whole playlist.': ['Tapez au moins deux lettres pour chercher dans toute la playlist.', 'Mindestens zwei Buchstaben eingeben, um die ganze Playlist zu durchsuchen.', 'Escribe al menos dos letras para buscar en toda la lista.'],
  'Searches all channels, plus the movie & series categories you have opened.': ['Cherche dans toutes les chaînes et les catégories de films et séries ouvertes.', 'Durchsucht alle Sender und die geöffneten Film- und Serienkategorien.', 'Busca en todos los canales y en las categorías de películas y series abiertas.'],
  'This category is locked': ['Cette catégorie est verrouillée', 'Diese Kategorie ist gesperrt', 'Esta categoría está bloqueada'],
  'Need the PIN to open': ['Code PIN requis', 'PIN zum Öffnen nötig', 'Se necesita el PIN'],
  Locked: ['Verrouillé', 'Gesperrt', 'Bloqueado'],
  // detail / player
  Play: ['Lecture', 'Abspielen', 'Reproducir'],
  'Play Now': ['Regarder', 'Jetzt abspielen', 'Ver ahora'],
  Resume: ['Reprendre', 'Fortsetzen', 'Continuar'],
  Watch: ['Regarder', 'Ansehen', 'Ver'],
  Pause: ['Pause', 'Pause', 'Pausa'],
  'Full Screen': ['Plein écran', 'Vollbild', 'Pantalla completa'],
  Fullscreen: ['Plein écran', 'Vollbild', 'Pantalla completa'],
  'Catch-Up': ['Replay', 'Catch-Up', 'Catch-Up'],
  Episode: ['Épisode', 'Episode', 'Episodio'],
  Director: ['Réalisateur', 'Regie', 'Director'],
  Cast: ['Casting', 'Besetzung', 'Reparto'],
  Genre: ['Genre', 'Genre', 'Género'],
  Trailer: ['Bande-annonce', 'Trailer', 'Tráiler'],
  'No episodes yet': ['Pas encore d’épisodes', 'Noch keine Episoden', 'Aún no hay episodios'],
  'No information': ['Aucune information', 'Keine Informationen', 'Sin información'],
  'Movie not found': ['Film introuvable', 'Film nicht gefunden', 'Película no encontrada'],
  'Series not found': ['Série introuvable', 'Serie nicht gefunden', 'Serie no encontrada'],
  'No programme information.': ['Aucune information de programme.', 'Keine Programminformationen.', 'Sin información de programación.'],
  'No recordings available for this channel.': ['Aucun enregistrement pour cette chaîne.', 'Keine Aufnahmen für diesen Sender.', 'No hay grabaciones para este canal.'],
  'Programme guide': ['Programme', 'Programm', 'Programación'],
  'Channel list': ['Liste des chaînes', 'Senderliste', 'Lista de canales'],
  'Change channel': ['Changer de chaîne', 'Sender wechseln', 'Cambiar de canal'],
  'Next channel': ['Chaîne suivante', 'Nächster Sender', 'Canal siguiente'],
  'Previous channel': ['Chaîne précédente', 'Vorheriger Sender', 'Canal anterior'],
  'Back 10 seconds': ['Reculer de 10 s', '10 Sek. zurück', 'Atrás 10 segundos'],
  'Forward 10 seconds': ['Avancer de 10 s', '10 Sek. vor', 'Adelante 10 segundos'],
  Back: ['Retour', 'Zurück', 'Atrás'],
  Audio: ['Audio', 'Audio', 'Audio'],
  'Audio tracks': ['Pistes audio', 'Tonspuren', 'Pistas de audio'],
  Subtitles: ['Sous-titres', 'Untertitel', 'Subtítulos'],
  Quality: ['Qualité', 'Qualität', 'Calidad'],
  Speed: ['Vitesse', 'Geschwindigkeit', 'Velocidad'],
  'Playback Speed': ['Vitesse de lecture', 'Wiedergabegeschwindigkeit', 'Velocidad de reproducción'],
  'Aspect Ratio': ['Format d’image', 'Seitenverhältnis', 'Relación de aspecto'],
  'Aspect ratio': ['Format d’image', 'Seitenverhältnis', 'Relación de aspecto'],
  Fit: ['Ajuster', 'Einpassen', 'Ajustar'],
  'Zoom / Fill': ['Zoom / Remplir', 'Zoom / Füllen', 'Zoom / Rellenar'],
  Stretch: ['Étirer', 'Strecken', 'Estirar'],
  'Sleep Timer': ['Minuterie', 'Sleep-Timer', 'Temporizador'],
  'Sleep timer': ['Minuterie', 'Sleep-Timer', 'Temporizador'],
  'Sleep timer: playback stopped': ['Minuterie : lecture arrêtée', 'Sleep-Timer: Wiedergabe gestoppt', 'Temporizador: reproducción detenida'],
  'Picture in Picture': ['Image dans l’image', 'Bild-in-Bild', 'Imagen en imagen'],
  'Picture in Picture is not available here': ['Image dans l’image indisponible ici', 'Bild-in-Bild ist hier nicht verfügbar', 'Imagen en imagen no disponible aquí'],
  Mute: ['Muet', 'Stumm', 'Silenciar'],
  Volume: ['Volume', 'Lautstärke', 'Volumen'],
  Cancel: ['Annuler', 'Abbrechen', 'Cancelar'],
  Close: ['Fermer', 'Schließen', 'Cerrar'],
  Off: ['Désactivé', 'Aus', 'Apagado'],
  'Copy link': ['Copier le lien', 'Link kopieren', 'Copiar enlace'],
  'Stream link copied': ['Lien copié', 'Link kopiert', 'Enlace copiado'],
  'Open in VLC': ['Ouvrir dans VLC', 'In VLC öffnen', 'Abrir en VLC'],
  'Pro player': ['Lecteur Pro', 'Pro-Player', 'Reproductor Pro'],
  'Pro player (all sound formats)': ['Lecteur Pro (tous les formats audio)', 'Pro-Player (alle Tonformate)', 'Reproductor Pro (todos los formatos de audio)'],
  'No sound?': ['Pas de son ?', 'Kein Ton?', '¿Sin sonido?'],
  'No picture?': ['Pas d’image ?', 'Kein Bild?', '¿Sin imagen?'],
  'Play with': ['Lire avec', 'Abspielen mit', 'Reproducir con'],
  'Can’t play this stream': ['Impossible de lire ce flux', 'Stream kann nicht abgespielt werden', 'No se puede reproducir este canal'],
  'This sound is Dolby/DTS — playing in the Pro player': ['Son Dolby/DTS — lecture dans le lecteur Pro', 'Dolby/DTS-Ton — läuft im Pro-Player', 'Audio Dolby/DTS — reproduciendo en el reproductor Pro'],
  'This sound is Dolby/DTS — switching to the Pro player': ['Son Dolby/DTS — passage au lecteur Pro', 'Dolby/DTS-Ton — Wechsel zum Pro-Player', 'Audio Dolby/DTS — cambiando al reproductor Pro'],
  'This picture format needs the Pro player — switching': ['Ce format d’image nécessite le lecteur Pro — passage', 'Dieses Bildformat braucht den Pro-Player — Wechsel', 'Este formato de imagen necesita el reproductor Pro — cambiando'],
  'Opening in the Pro player…': ['Ouverture dans le lecteur Pro…', 'Öffnet im Pro-Player…', 'Abriendo en el reproductor Pro…'],
  'Auto-play next episode': ['Lecture auto de l’épisode suivant', 'Nächste Episode automatisch', 'Reproducir siguiente episodio'],
  'Added to Favorites': ['Ajouté aux favoris', 'Zu Favoriten hinzugefügt', 'Añadido a favoritos'],
  'Removed from Favorites': ['Retiré des favoris', 'Aus Favoriten entfernt', 'Eliminado de favoritos'],
  'Loading TV Guide…': ['Chargement du guide TV…', 'TV-Programm wird geladen…', 'Cargando guía de TV…'],
  'Loading TV Guide… large guides can take a minute.': ['Chargement du guide TV… cela peut prendre une minute.', 'TV-Programm wird geladen… große Programme brauchen eine Minute.', 'Cargando guía de TV… puede tardar un minuto.'],
  'No TV Guide source': ['Aucune source de guide TV', 'Keine TV-Programm-Quelle', 'Sin fuente de guía de TV'],
  'Reload guide': ['Recharger le guide', 'Programm neu laden', 'Recargar guía'],
  'Reload TV Guide': ['Recharger le guide TV', 'TV-Programm neu laden', 'Recargar guía de TV'],
  'TV Guide updated': ['Guide TV mis à jour', 'TV-Programm aktualisiert', 'Guía de TV actualizada'],
  'Your playlist doesn’t provide an EPG. Add an XMLTV URL in Settings › TV Guide.': ['Votre playlist n’a pas d’EPG. Ajoutez une URL XMLTV dans Paramètres › Guide TV.', 'Deine Playlist hat kein EPG. Füge eine XMLTV-URL unter Einstellungen › TV-Programm hinzu.', 'Tu lista no tiene EPG. Añade una URL XMLTV en Ajustes › Guía de TV.'],
  'Open Channel': ['Ouvrir la chaîne', 'Sender öffnen', 'Abrir canal'],
  'Add Channel': ['Ajouter une chaîne', 'Sender hinzufügen', 'Añadir canal'],
  '2 Screens': ['2 écrans', '2 Bildschirme', '2 pantallas'],
  '4 Screens': ['4 écrans', '4 Bildschirme', '4 pantallas'],
  'Watch several channels at once — tap a screen to hear it.': ['Regardez plusieurs chaînes à la fois — touchez un écran pour l’écouter.', 'Mehrere Sender gleichzeitig — tippe auf einen Bildschirm, um ihn zu hören.', 'Mira varios canales a la vez — toca una pantalla para oírla.'],
  'Each screen uses one connection from your subscription.': ['Chaque écran utilise une connexion de votre abonnement.', 'Jeder Bildschirm nutzt eine Verbindung deines Abos.', 'Cada pantalla usa una conexión de tu suscripción.'],
  // playlists / welcome
  'Add Playlist': ['Ajouter une playlist', 'Playlist hinzufügen', 'Añadir lista'],
  'Edit Playlist': ['Modifier la playlist', 'Playlist bearbeiten', 'Editar lista'],
  'Add your playlist from your phone': ['Ajoutez votre playlist depuis votre téléphone', 'Füge deine Playlist vom Handy hinzu', 'Añade tu lista desde el móvil'],
  'Enter your MAC Address and Device Key': ['Entrez votre adresse MAC et votre clé d’appareil', 'Gib deine MAC-Adresse und den Geräteschlüssel ein', 'Introduce tu dirección MAC y la clave del dispositivo'],
  'Add your M3U link or Xtream login — it appears here automatically': ['Ajoutez votre lien M3U ou vos identifiants Xtream — ils apparaissent ici automatiquement', 'Füge deinen M3U-Link oder Xtream-Login hinzu — erscheint hier automatisch', 'Añade tu enlace M3U o acceso Xtream — aparece aquí automáticamente'],
  'Live TV, movies and series from your own playlist — beautifully, on every screen.': ['TV en direct, films et séries de votre playlist — sur tous vos écrans.', 'Live-TV, Filme und Serien aus deiner Playlist — schön, auf jedem Bildschirm.', 'TV en vivo, películas y series de tu propia lista — en todas tus pantallas.'],
  'IPTV PLAYER does not provide any content. Add a playlist from your own provider.': ['IPTV PLAYER ne fournit aucun contenu. Ajoutez une playlist de votre fournisseur.', 'IPTV PLAYER bietet keine Inhalte. Füge eine Playlist deines Anbieters hinzu.', 'IPTV PLAYER no ofrece contenido. Añade una lista de tu proveedor.'],
  'IPTV PLAYER is a media player. It does not include or sell any channels or content — add a playlist from your own provider.': ['IPTV PLAYER est un lecteur multimédia. Il n’inclut ni ne vend aucune chaîne — ajoutez une playlist de votre fournisseur.', 'IPTV PLAYER ist ein Mediaplayer. Er enthält oder verkauft keine Sender — füge eine Playlist deines Anbieters hinzu.', 'IPTV PLAYER es un reproductor. No incluye ni vende canales — añade una lista de tu proveedor.'],
  'Xtream Codes': ['Xtream Codes', 'Xtream Codes', 'Xtream Codes'],
  'M3U File': ['Fichier M3U', 'M3U-Datei', 'Archivo M3U'],
  'M3U file': ['Fichier M3U', 'M3U-Datei', 'Archivo M3U'],
  'Playlist name': ['Nom de la playlist', 'Name der Playlist', 'Nombre de la lista'],
  'Playlist URL': ['URL de la playlist', 'Playlist-URL', 'URL de la lista'],
  'Playlist file': ['Fichier playlist', 'Playlist-Datei', 'Archivo de lista'],
  'Server URL': ['URL du serveur', 'Server-URL', 'URL del servidor'],
  Username: ['Nom d’utilisateur', 'Benutzername', 'Usuario'],
  Password: ['Mot de passe', 'Passwort', 'Contraseña'],
  'EPG URL (optional)': ['URL EPG (facultatif)', 'EPG-URL (optional)', 'URL EPG (opcional)'],
  'Choose .m3u / .m3u8 file': ['Choisir un fichier .m3u / .m3u8', '.m3u / .m3u8-Datei wählen', 'Elegir archivo .m3u / .m3u8'],
  'Replace file (optional)': ['Remplacer le fichier (facultatif)', 'Datei ersetzen (optional)', 'Reemplazar archivo (opcional)'],
  'Xtream Codes details detected': ['Identifiants Xtream Codes détectés', 'Xtream-Codes-Daten erkannt', 'Datos Xtream Codes detectados'],
  Save: ['Enregistrer', 'Speichern', 'Guardar'],
  Continue: ['Continuer', 'Weiter', 'Continuar'],
  Edit: ['Modifier', 'Bearbeiten', 'Editar'],
  Delete: ['Supprimer', 'Löschen', 'Eliminar'],
  Remove: ['Retirer', 'Entfernen', 'Quitar'],
  Refresh: ['Actualiser', 'Aktualisieren', 'Actualizar'],
  REFRESH: ['ACTUALISER', 'AKTUALISIEREN', 'ACTUALIZAR'],
  Contact: ['Contact', 'Kontakt', 'Contacto'],
  'Contact us': ['Nous contacter', 'Kontakt', 'Contáctanos'],
  'Scan the code with your phone, or send us a message. Include your MAC Address and Device Key:': ['Scannez le code avec votre téléphone ou envoyez-nous un message avec votre adresse MAC et votre clé d’appareil :', 'Scanne den Code mit dem Handy oder schreib uns – mit MAC-Adresse und Geräteschlüssel:', 'Escanea el código con tu móvil o envíanos un mensaje con tu dirección MAC y la clave del dispositivo:'],
  'CHANGE PLAYLIST': ['CHANGER DE PLAYLIST', 'PLAYLIST WECHSELN', 'CAMBIAR LISTA'],
  'Change playlist': ['Changer de playlist', 'Playlist wechseln', 'Cambiar lista'],
  'Delete playlist?': ['Supprimer la playlist ?', 'Playlist löschen?', '¿Eliminar la lista?'],
  'Playlist added': ['Playlist ajoutée', 'Playlist hinzugefügt', 'Lista añadida'],
  'Playlist saved': ['Playlist enregistrée', 'Playlist gespeichert', 'Lista guardada'],
  'Playlist updated': ['Playlist mise à jour', 'Playlist aktualisiert', 'Lista actualizada'],
  'Playlists are up to date': ['Les playlists sont à jour', 'Playlists sind aktuell', 'Las listas están actualizadas'],
  'Playlists updated from the website': ['Playlists mises à jour depuis le site', 'Playlists von der Website aktualisiert', 'Listas actualizadas desde la web'],
  'Could not reach the website — check your internet': ['Site injoignable — vérifiez votre connexion', 'Website nicht erreichbar — Internet prüfen', 'No se pudo conectar con la web — revisa tu internet'],
  'Edit this playlist on the website': ['Modifiez cette playlist sur le site', 'Diese Playlist auf der Website bearbeiten', 'Edita esta lista en la web'],
  'Remove this playlist on the website': ['Supprimez cette playlist sur le site', 'Diese Playlist auf der Website entfernen', 'Elimina esta lista en la web'],
  'Couldn’t load your playlist': ['Impossible de charger votre playlist', 'Playlist konnte nicht geladen werden', 'No se pudo cargar tu lista'],
  'This playlist is empty': ['Cette playlist est vide', 'Diese Playlist ist leer', 'Esta lista está vacía'],
  'Your provider returned no channels, movies or series.': ['Votre fournisseur n’a renvoyé aucune chaîne, film ou série.', 'Dein Anbieter hat keine Sender, Filme oder Serien geliefert.', 'Tu proveedor no devolvió canales, películas ni series.'],
  'Update playlist now': ['Mettre à jour la playlist', 'Playlist jetzt aktualisieren', 'Actualizar lista ahora'],
  'Re-downloads channels and TV guide': ['Retélécharge les chaînes et le guide TV', 'Lädt Sender und TV-Programm neu', 'Vuelve a descargar canales y guía de TV'],
  'Open Settings': ['Ouvrir les paramètres', 'Einstellungen öffnen', 'Abrir ajustes'],
  'Account information is available for Xtream Codes playlists.': ['Les infos du compte sont disponibles pour les playlists Xtream Codes.', 'Kontoinfos gibt es für Xtream-Codes-Playlists.', 'La información de la cuenta está disponible para listas Xtream Codes.'],
  'No account details': ['Aucun détail de compte', 'Keine Kontodaten', 'Sin datos de la cuenta'],
  // activation / licence
  'MAC Address': ['Adresse MAC', 'MAC-Adresse', 'Dirección MAC'],
  'Device Key': ['Clé d’appareil', 'Geräteschlüssel', 'Clave del dispositivo'],
  'Device activation': ['Activation de l’appareil', 'Geräteaktivierung', 'Activación del dispositivo'],
  'Sync playlists from website': ['Synchroniser les playlists du site', 'Playlists von der Website synchronisieren', 'Sincronizar listas desde la web'],
  'Syncing…': ['Synchronisation…', 'Synchronisiere…', 'Sincronizando…'],
  'Reset Device Key': ['Réinitialiser la clé d’appareil', 'Geräteschlüssel zurücksetzen', 'Restablecer clave del dispositivo'],
  'Disconnects this device from the website until you activate it again': ['Déconnecte cet appareil du site jusqu’à une nouvelle activation', 'Trennt dieses Gerät von der Website, bis du es neu aktivierst', 'Desconecta este dispositivo de la web hasta que lo actives de nuevo'],
  'New Device Key created': ['Nouvelle clé d’appareil créée', 'Neuer Geräteschlüssel erstellt', 'Nueva clave del dispositivo creada'],
  Subscription: ['Abonnement', 'Abonnement', 'Suscripción'],
  'Device blocked': ['Appareil bloqué', 'Gerät gesperrt', 'Dispositivo bloqueado'],
  'To unblock your device, contact us:': ['Pour débloquer votre appareil, contactez-nous :', 'Um dein Gerät zu entsperren, kontaktiere uns:', 'Para desbloquear tu dispositivo, contáctanos:'],
  'Give us your MAC Address and Device Key:': ['Donnez-nous votre adresse MAC et votre clé d’appareil :', 'Nenne uns deine MAC-Adresse und den Geräteschlüssel:', 'Danos tu dirección MAC y la clave del dispositivo:'],
  'Need help? Contact us on our website': ['Besoin d’aide ? Contactez-nous sur notre site', 'Hilfe nötig? Kontaktiere uns auf unserer Website', '¿Necesitas ayuda? Contáctanos en nuestra web'],
  'Scan the code with your phone or open our website. Include your MAC Address and Device Key:': ['Scannez le code avec votre téléphone ou ouvrez notre site. Indiquez votre adresse MAC et votre clé d’appareil :', 'Scanne den Code mit deinem Handy oder öffne unsere Website. Gib deine MAC-Adresse und deinen Geräteschlüssel an:', 'Escanea el código con tu móvil o abre nuestra web. Indica tu dirección MAC y tu clave de dispositivo:'],
  'Open website': ['Ouvrir le site', 'Website öffnen', 'Abrir la web'],
  'Privacy Policy': ['Politique de confidentialité', 'Datenschutzerklärung', 'Política de privacidad'],
  'Terms of Use': ['Conditions d’utilisation', 'Nutzungsbedingungen', 'Términos de uso'],
  'To unblock your device, contact us on our website:': ['Pour débloquer votre appareil, contactez-nous sur notre site :', 'Um dein Gerät zu entsperren, kontaktiere uns auf unserer Website:', 'Para desbloquear tu dispositivo, contáctanos en nuestra web:'],
  'Get the lifetime licence to keep using IPTV PLAYER.': ['Obtenez la licence à vie pour continuer à utiliser IPTV PLAYER.', 'Hol dir die lebenslange Lizenz, um IPTV PLAYER weiter zu nutzen.', 'Consigue la licencia de por vida para seguir usando IPTV PLAYER.'],
  'LIFETIME': ['À VIE', 'LEBENSLANG', 'DE POR VIDA'],
  'Lifetime licence': ['Licence à vie', 'Lebenslange Lizenz', 'Licencia de por vida'],
  'pay once, use forever': ['un seul paiement, pour toujours', 'einmal zahlen, für immer nutzen', 'pago único, para siempre'],
  'Buy lifetime': ['Acheter à vie', 'Lebenslang kaufen', 'Comprar de por vida'],
  'Restore purchase': ['Restaurer l’achat', 'Kauf wiederherstellen', 'Restaurar compra'],
  'Restore Google Play purchase': ['Restaurer l’achat Google Play', 'Google-Play-Kauf wiederherstellen', 'Restaurar compra de Google Play'],
  'Scan to open our website': ['Scannez pour ouvrir notre site', 'Scannen, um unsere Website zu öffnen', 'Escanea para abrir nuestra web'],
  'IPTV PLAYER is a media player only. It does not include any channels or content.': ['IPTV PLAYER est uniquement un lecteur multimédia. Il ne contient aucune chaîne ni aucun contenu.', 'IPTV PLAYER ist nur ein Mediaplayer. Er enthält keine Sender und keine Inhalte.', 'IPTV PLAYER es solo un reproductor multimedia. No incluye canales ni contenido.'],
  'Purchase restored.': ['Achat restauré.', 'Kauf wiederhergestellt.', 'Compra restaurada.'],
  'No purchase found for this Google account.': ['Aucun achat trouvé pour ce compte Google.', 'Kein Kauf für dieses Google-Konto gefunden.', 'No se encontró ninguna compra para esta cuenta de Google.'],
  'Thank you! IPTV PLAYER is activated for life.': ['Merci ! IPTV PLAYER est activé à vie.', 'Danke! IPTV PLAYER ist lebenslang aktiviert.', '¡Gracias! IPTV PLAYER está activado de por vida.'],
  'Payment pending — the app unlocks as soon as Google confirms it.': ['Paiement en attente — l’app se débloque dès que Google le confirme.', 'Zahlung ausstehend — die App wird freigeschaltet, sobald Google sie bestätigt.', 'Pago pendiente — la app se desbloquea en cuanto Google lo confirme.'],
  'Google Play payment is not available right now.': ['Le paiement Google Play n’est pas disponible pour le moment.', 'Google-Play-Zahlung ist gerade nicht verfügbar.', 'El pago de Google Play no está disponible ahora.'],
  'Your playlist has no sports categories (Sports, Football, F1…).': ['Votre playlist n’a pas de catégories sport (Sport, Football, F1…).', 'Deine Playlist hat keine Sportkategorien (Sport, Fußball, F1…).', 'Tu lista no tiene categorías de deportes (Deportes, Fútbol, F1…).'],
  'Check again': ['Vérifier à nouveau', 'Erneut prüfen', 'Comprobar de nuevo'],
  'Your 7-day free trial has ended': ['Votre essai gratuit de 7 jours est terminé', 'Deine 7-tägige Testphase ist beendet', 'Tu prueba gratuita de 7 días ha terminado'],
  'Your subscription has ended': ['Votre abonnement est terminé', 'Dein Abonnement ist abgelaufen', 'Tu suscripción ha terminado'],
  'Activate IPTV PLAYER on this device to keep watching.': ['Activez IPTV PLAYER sur cet appareil pour continuer à regarder.', 'Aktiviere IPTV PLAYER auf diesem Gerät, um weiterzuschauen.', 'Activa IPTV PLAYER en este dispositivo para seguir viendo.'],
  '1 Year': ['1 an', '1 Jahr', '1 año'],
  Lifetime: ['À vie', 'Lebenslang', 'De por vida'],
  'per device / year': ['par appareil / an', 'pro Gerät / Jahr', 'por dispositivo / año'],
  'pay once, forever': ['un seul paiement, pour toujours', 'einmal zahlen, für immer', 'pago único, para siempre'],
  'BEST VALUE': ['MEILLEUR PRIX', 'BESTER PREIS', 'MEJOR PRECIO'],
  'I have paid — check again': ['J’ai payé — vérifier', 'Ich habe bezahlt — erneut prüfen', 'Ya he pagado — comprobar'],
  'Lifetime — activated': ['À vie — activé', 'Lebenslang — aktiviert', 'De por vida — activado'],
  Expired: ['Expiré', 'Abgelaufen', 'Caducado'],
  // settings
  Appearance: ['Apparence', 'Darstellung', 'Apariencia'],
  'App language': ['Langue de l’application', 'App-Sprache', 'Idioma de la app'],
  Language: ['Langue', 'Sprache', 'Idioma'],
  'Whole app in your language (Auto = language of your country)': ['Toute l’application dans votre langue (Auto = langue de votre pays)', 'Ganze App in deiner Sprache (Auto = Sprache deines Landes)', 'Toda la app en tu idioma (Auto = idioma de tu país)'],
  Theme: ['Thème', 'Design', 'Tema'],
  Dark: ['Sombre', 'Dunkel', 'Oscuro'],
  Light: ['Clair', 'Hell', 'Claro'],
  Auto: ['Auto', 'Auto', 'Auto'],
  'Accent color': ['Couleur d’accent', 'Akzentfarbe', 'Color de acento'],
  'Time format': ['Format de l’heure', 'Zeitformat', 'Formato de hora'],
  '24-hour': ['24 heures', '24 Stunden', '24 horas'],
  '12-hour': ['12 heures', '12 Stunden', '12 horas'],
  'Show channel numbers': ['Afficher les numéros de chaîne', 'Sendernummern anzeigen', 'Mostrar números de canal'],
  'Start with last channel': ['Démarrer sur la dernière chaîne', 'Mit letztem Sender starten', 'Empezar con el último canal'],
  'Opens the last live channel when the app starts': ['Ouvre la dernière chaîne au démarrage', 'Öffnet beim Start den letzten Live-Sender', 'Abre el último canal al iniciar la app'],
  Country: ['Pays', 'Land', 'País'],
  'Background flag': ['Drapeau d’arrière-plan', 'Hintergrundflagge', 'Bandera de fondo'],
  'The flag in the background picture (Auto = your country)': ['Le drapeau de l’image de fond (Auto = votre pays)', 'Die Flagge im Hintergrundbild (Auto = dein Land)', 'La bandera de la imagen de fondo (Auto = tu país)'],
  Player: ['Lecteur', 'Player', 'Reproductor'],
  'Player engine': ['Moteur de lecture', 'Player-Engine', 'Motor de reproducción'],
  'Built-in': ['Intégré', 'Integriert', 'Integrado'],
  Pro: ['Pro', 'Pro', 'Pro'],
  'Pro = VLC engine: every picture & sound format (best for Firestick / old TVs)': ['Pro = moteur VLC : tous les formats image et son (idéal Firestick / anciennes TV)', 'Pro = VLC-Engine: alle Bild- und Tonformate (ideal für Firestick / ältere TVs)', 'Pro = motor VLC: todos los formatos de imagen y sonido (ideal para Firestick / TV antiguas)'],
  'Live stream format': ['Format du direct', 'Live-Stream-Format', 'Formato de directo'],
  'MPEG-TS is lower latency; HLS works on more devices': ['MPEG-TS a moins de latence ; HLS fonctionne sur plus d’appareils', 'MPEG-TS hat weniger Verzögerung; HLS läuft auf mehr Geräten', 'MPEG-TS tiene menos retraso; HLS funciona en más dispositivos'],
  'Buffer size': ['Taille du tampon', 'Puffergröße', 'Tamaño del búfer'],
  'Higher buffer = fewer freezes on slow internet': ['Tampon plus grand = moins de coupures sur une connexion lente', 'Größerer Puffer = weniger Ruckler bei langsamem Internet', 'Más búfer = menos cortes con internet lento'],
  Low: ['Faible', 'Niedrig', 'Bajo'],
  Normal: ['Normal', 'Normal', 'Normal'],
  High: ['Élevé', 'Hoch', 'Alto'],
  'Default aspect ratio': ['Format d’image par défaut', 'Standard-Seitenverhältnis', 'Relación de aspecto predeterminada'],
  'Subtitle size': ['Taille des sous-titres', 'Untertitelgröße', 'Tamaño de subtítulos'],
  'Subtitle background': ['Fond des sous-titres', 'Untertitel-Hintergrund', 'Fondo de subtítulos'],
  'Custom EPG (XMLTV) URL': ['URL EPG personnalisée (XMLTV)', 'Eigene EPG-URL (XMLTV)', 'URL EPG personalizada (XMLTV)'],
  'Leave empty to use the guide supplied by your playlist.': ['Laissez vide pour utiliser le guide de votre playlist.', 'Leer lassen, um das Programm deiner Playlist zu nutzen.', 'Déjalo vacío para usar la guía de tu lista.'],
  'EPG time shift': ['Décalage horaire EPG', 'EPG-Zeitverschiebung', 'Desfase horario EPG'],
  'Fix guides that show the wrong time': ['Corrige les guides qui affichent la mauvaise heure', 'Korrigiert Programme mit falscher Uhrzeit', 'Corrige guías con la hora equivocada'],
  'Parental Control': ['Contrôle parental', 'Kindersicherung', 'Control parental'],
  'Lock adult categories automatically': ['Verrouiller automatiquement les catégories adultes', 'Erwachsenenkategorien automatisch sperren', 'Bloquear categorías para adultos automáticamente'],
  'Locked categories': ['Catégories verrouillées', 'Gesperrte Kategorien', 'Categorías bloqueadas'],
  'Locked Categories': ['Catégories verrouillées', 'Gesperrte Kategorien', 'Categorías bloqueadas'],
  'Hidden categories': ['Catégories masquées', 'Ausgeblendete Kategorien', 'Categorías ocultas'],
  'Hidden Categories': ['Catégories masquées', 'Ausgeblendete Kategorien', 'Categorías ocultas'],
  'Remove categories you never watch': ['Masquez les catégories que vous ne regardez jamais', 'Blende Kategorien aus, die du nie schaust', 'Oculta las categorías que nunca ves'],
  'Change PIN': ['Changer le code PIN', 'PIN ändern', 'Cambiar PIN'],
  'Enter PIN': ['Entrez le code PIN', 'PIN eingeben', 'Introduce el PIN'],
  'Enter current PIN': ['Entrez le code PIN actuel', 'Aktuelle PIN eingeben', 'Introduce el PIN actual'],
  'Choose a new PIN': ['Choisissez un nouveau code PIN', 'Neue PIN wählen', 'Elige un PIN nuevo'],
  'PIN changed': ['Code PIN modifié', 'PIN geändert', 'PIN cambiado'],
  'Lock again now': ['Verrouiller maintenant', 'Jetzt wieder sperren', 'Bloquear ahora'],
  'Default PIN is 0000 — change it in Settings › Parental Control.': ['Le code PIN par défaut est 0000 — changez-le dans Paramètres › Contrôle parental.', 'Standard-PIN ist 0000 — ändere sie unter Einstellungen › Kindersicherung.', 'El PIN por defecto es 0000 — cámbialo en Ajustes › Control parental.'],
  Network: ['Réseau', 'Netzwerk', 'Red'],
  'Proxy URL': ['URL du proxy', 'Proxy-URL', 'URL del proxy'],
  'Send video streams through proxy too': ['Faire passer aussi la vidéo par le proxy', 'Videostreams auch über den Proxy senden', 'Enviar también el vídeo por el proxy'],
  Data: ['Données', 'Daten', 'Datos'],
  'Export backup': ['Exporter une sauvegarde', 'Backup exportieren', 'Exportar copia'],
  'Restore backup': ['Restaurer une sauvegarde', 'Backup wiederherstellen', 'Restaurar copia'],
  'Playlists, favorites, history and settings': ['Playlists, favoris, historique et paramètres', 'Playlists, Favoriten, Verlauf und Einstellungen', 'Listas, favoritos, historial y ajustes'],
  'Backup restored — reloading…': ['Sauvegarde restaurée — rechargement…', 'Backup wiederhergestellt — lädt neu…', 'Copia restaurada — recargando…'],
  'That backup file is not valid': ['Ce fichier de sauvegarde n’est pas valide', 'Diese Backup-Datei ist ungültig', 'Ese archivo de copia no es válido'],
  'Clear cache': ['Vider le cache', 'Cache leeren', 'Borrar caché'],
  'Reset settings': ['Réinitialiser les paramètres', 'Einstellungen zurücksetzen', 'Restablecer ajustes'],
  'Settings reset': ['Paramètres réinitialisés', 'Einstellungen zurückgesetzt', 'Ajustes restablecidos'],
  About: ['À propos', 'Über', 'Acerca de'],
  'Check now': ['Vérifier', 'Jetzt prüfen', 'Comprobar'],
  'Auto-detected when available': ['Détecté automatiquement si disponible', 'Automatisch erkannt, wenn verfügbar', 'Detectado automáticamente si está disponible'],
  Clear: ['Effacer', 'Leeren', 'Borrar'],
  Yes: ['Oui', 'Ja', 'Sí'],
  No: ['Non', 'Nein', 'No'],
  Main: ['Principal', 'Haupt', 'Principal'],
  Tabs: ['Onglets', 'Tabs', 'Pestañas'],
  Loading: ['Chargement', 'Lädt', 'Cargando'],
  'Loading…': ['Chargement…', 'Lädt…', 'Cargando…'],
  Expires: ['Expire le', 'Läuft ab am', 'Caduca el'],
  Status: ['Statut', 'Status', 'Estado'],
  'Expiry date': ['Date d’expiration', 'Ablaufdatum', 'Fecha de caducidad'],
  Created: ['Créé le', 'Erstellt', 'Creado'],
  Trial: ['Essai', 'Test', 'Prueba'],
  'Active connections': ['Connexions actives', 'Aktive Verbindungen', 'Conexiones activas'],
  'Max connections': ['Connexions max.', 'Max. Verbindungen', 'Conexiones máx.'],
  Formats: ['Formats', 'Formate', 'Formatos'],
  Server: ['Serveur', 'Server', 'Servidor'],
  'Server time zone': ['Fuseau horaire du serveur', 'Server-Zeitzone', 'Zona horaria del servidor'],
  active: ['actif', 'aktiv', 'activo'],
  Active: ['Actif', 'Aktiv', 'Activo'],
  'No picture? This video format needs': ['Pas d’image ? Ce format vidéo nécessite', 'Kein Bild? Dieses Videoformat braucht', '¿Sin imagen? Este formato de vídeo necesita'],
  'No sound? This uses Dolby/DTS audio —': ['Pas de son ? Audio Dolby/DTS —', 'Kein Ton? Dolby/DTS-Ton —', '¿Sin sonido? Audio Dolby/DTS —'],
  'Pro player:': ['Lecteur Pro :', 'Pro-Player:', 'Reproductor Pro:'],
  Episodes: ['Épisodes', 'Episoden', 'Episodios'],
  Seasons: ['Saisons', 'Staffeln', 'Temporadas'],
  Plot: ['Résumé', 'Handlung', 'Sinopsis'],
  'Next episode': ['Épisode suivant', 'Nächste Episode', 'Siguiente episodio'],
  'Up next': ['À suivre', 'Als Nächstes', 'A continuación'],
  'Next up': ['À suivre', 'Als Nächstes', 'A continuación'],
  'Scan the code or open': ['Scannez le code ou ouvrez', 'Scanne den Code oder öffne', 'Escanea el código o abre'],
  'Waiting for your playlist…': ['En attente de votre playlist…', 'Warte auf deine Playlist…', 'Esperando tu lista…'],
  "Add playlist on this device": ["Ajouter une playlist sur cet appareil", "Playlist auf diesem Gerät hinzufügen", "Añadir lista en este dispositivo"],
  "Tip: paste a full “get.php?username=…” link in the M3U URL tab — it will be converted automatically.": ["Astuce : collez un lien complet « get.php?username=… » dans l’onglet M3U — il sera converti automatiquement.", "Tipp: Füge einen vollständigen „get.php?username=…“-Link im M3U-Tab ein — er wird automatisch umgewandelt.", "Consejo: pega un enlace completo «get.php?username=…» en la pestaña M3U — se convertirá automáticamente."],
  "External": ["Externe", "Extern", "Externo"],
}

// Sentences with numbers / names
const P: [RegExp, (m: RegExpMatchArray) => [string, string, string]][] = [
  [/^“(.*)” starts now on (.+)$/, (m) => [`« ${m[1]} » commence maintenant sur ${m[2]}`, `„${m[1]}“ beginnt jetzt auf ${m[2]}`, `«${m[1]}» empieza ahora en ${m[2]}`]],
  [/^([\d.,\s]+) channels$/, (m) => [`${m[1]} chaînes`, `${m[1]} Sender`, `${m[1]} canales`]],
  [/^([\d.,\s]+) titles$/, (m) => [`${m[1]} titres`, `${m[1]} Titel`, `${m[1]} títulos`]],
  [/^([\d.,\s]+) titles in this category$/, (m) => [`${m[1]} titres dans cette catégorie`, `${m[1]} Titel in dieser Kategorie`, `${m[1]} títulos en esta categoría`]],
  [/^([\d.,\s]+) shows$/, (m) => [`${m[1]} séries`, `${m[1]} Serien`, `${m[1]} series`]],
  [/^([\d.,\s]+) categories$/, (m) => [`${m[1]} catégories`, `${m[1]} Kategorien`, `${m[1]} categorías`]],
  [/^Season (\d+)$/, (m) => [`Saison ${m[1]}`, `Staffel ${m[1]}`, `Temporada ${m[1]}`]],
  [/^S(\d+) · E(\d+) — (.*)$/, (m) => [`S${m[1]} · É${m[2]} — ${m[3]}`, `S${m[1]} · E${m[2]} — ${m[3]}`, `T${m[1]} · E${m[2]} — ${m[3]}`]],
  [/^(\d+) min left$/, (m) => [`${m[1]} min restantes`, `noch ${m[1]} Min.`, `quedan ${m[1]} min`]],
  [/^Version (.+)$/, (m) => [`Version ${m[1]}`, `Version ${m[1]}`, `Versión ${m[1]}`]],
  [/^Search (movies|series)$/, (m) => (m[1] === 'movies' ? ['Rechercher des films', 'Filme suchen', 'Buscar películas'] : ['Rechercher des séries', 'Serien suchen', 'Buscar series'])],
  [/^This playlist doesn’t include (movies|series)\.$/, (m) => (m[1] === 'movies' ? ['Cette playlist ne contient pas de films.', 'Diese Playlist enthält keine Filme.', 'Esta lista no incluye películas.'] : ['Cette playlist ne contient pas de séries.', 'Diese Playlist enthält keine Serien.', 'Esta lista no incluye series.'])],
  [/^No (movies|series)$/, (m) => (m[1] === 'movies' ? ['Aucun film', 'Keine Filme', 'Sin películas'] : ['Aucune série', 'Keine Serien', 'Sin series'])],
  [/^No results for “(.*)”$/, (m) => [`Aucun résultat pour « ${m[1]} »`, `Keine Ergebnisse für „${m[1]}“`, `Sin resultados para «${m[1]}»`]],
  [/^(Channels|Movies|Series) \((\d+)\)$/, (m) => {
    const w = { Channels: ['Chaînes', 'Sender', 'Canales'], Movies: ['Films', 'Filme', 'Películas'], Series: ['Séries', 'Serien', 'Series'] }[m[1]]!
    return [`${w[0]} (${m[2]})`, `${w[1]} (${m[2]})`, `${w[2]} (${m[2]})`]
  }],
  [/^Free trial: (\d+) days? left — then (\S+)\/year or (\S+) lifetime$/, (m) => [`Essai gratuit : ${m[1]} jour(s) restant(s) — puis ${m[2]}/an ou ${m[3]} à vie`, `Gratis-Test: noch ${m[1]} Tag(e) — dann ${m[2]}/Jahr oder ${m[3]} lebenslang`, `Prueba gratis: quedan ${m[1]} día(s) — luego ${m[2]}/año o ${m[3]} de por vida`]],
  [/^Free trial — (\d+) days? left · then (\S+)\/year or (\S+) lifetime$/, (m) => [`Essai gratuit — ${m[1]} jour(s) restant(s) · puis ${m[2]}/an ou ${m[3]} à vie`, `Gratis-Test — noch ${m[1]} Tag(e) · dann ${m[2]}/Jahr oder ${m[3]} lebenslang`, `Prueba gratis — quedan ${m[1]} día(s) · luego ${m[2]}/año o ${m[3]} de por vida`]],
  [/^Active until (.+)$/, (m) => [`Actif jusqu’au ${m[1]}`, `Aktiv bis ${m[1]}`, `Activo hasta ${m[1]}`]],
  [/^Playback will stop in (\d+) minutes$/, (m) => [`La lecture s’arrêtera dans ${m[1]} minutes`, `Wiedergabe stoppt in ${m[1]} Minuten`, `La reproducción se detendrá en ${m[1]} minutos`]],
  [/^Reminder set for “(.*)”$/, (m) => [`Rappel programmé pour « ${m[1]} »`, `Erinnerung für „${m[1]}“ gesetzt`, `Recordatorio para «${m[1]}»`]],
  [/^Playlist “(.*)” added from the website$/, (m) => [`Playlist « ${m[1]} » ajoutée depuis le site`, `Playlist „${m[1]}“ von der Website hinzugefügt`, `Lista «${m[1]}» añadida desde la web`]],
  [/^Channel (\S+) not found$/, (m) => [`Chaîne ${m[1]} introuvable`, `Sender ${m[1]} nicht gefunden`, `Canal ${m[1]} no encontrado`]],
  [/^(\d+) added · Active: (.*)$/, (m) => [`${m[1]} ajoutée(s) · Active : ${m[2]}`, `${m[1]} hinzugefügt · Aktiv: ${m[2]}`, `${m[1]} añadida(s) · Activa: ${m[2]}`]],
  [/^Last updated (.+)$/, (m) => [`Dernière mise à jour ${m[1]}`, `Zuletzt aktualisiert ${m[1]}`, `Última actualización ${m[1]}`]],
  [/^Last sync (.+)$/, (m) => [`Dernière synchro ${m[1]}`, `Letzte Synchronisierung ${m[1]}`, `Última sincronización ${m[1]}`]],
  [/^Open (\S+)\/activate on your phone and enter these codes to add playlists to this device\.$/, (m) => [`Ouvrez ${m[1]}/activate sur votre téléphone et entrez ces codes pour ajouter des playlists.`, `Öffne ${m[1]}/activate auf deinem Handy und gib diese Codes ein, um Playlists hinzuzufügen.`, `Abre ${m[1]}/activate en tu móvil e introduce estos códigos para añadir listas.`]],
  [/^Scan the code or open (.+)$/, (m) => [`Scannez le code ou ouvrez ${m[1]}`, `Scanne den Code oder öffne ${m[1]}`, `Escanea el código o abre ${m[1]}`]],
]

let lang: '' | L = ''
// Auto = the language of the user's country (France, Belgium, Morocco → French · Germany, Austria, Switzerland →
// German · Spain, Latin America → Spanish · Netherlands → Dutch · Portugal → Portuguese · Italy → Italian · Sweden →
// Swedish · everywhere else English, unless the device itself uses one of these languages)
const BY_COUNTRY: Record<string, L> = { FR: 'fr', BE: 'fr', MA: 'fr', DZ: 'fr', TN: 'fr', LU: 'fr', DE: 'de', AT: 'de', CH: 'de', ES: 'es', NL: 'nl', PT: 'pt', IT: 'it', SE: 'sv' }
const LATAM = /^America\/(Mexico_City|Cancun|Merida|Monterrey|Chihuahua|Tijuana|Bogota|Lima|Santiago|Caracas|Argentina|Buenos_Aires|Montevideo|Asuncion|La_Paz|Guayaquil|Panama|Costa_Rica|El_Salvador|Guatemala|Tegucigalpa|Managua|Santo_Domingo|Havana|Puerto_Rico)/
const ENGLISH = new Set(['GB', 'IE', 'US', 'CA', 'AU'])
function autoLang(): '' | L {
  let tz = ''
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {}
  if (LATAM.test(tz)) return 'es'
  if (/^Europe\/(Brussels|Luxembourg)$|^Africa\/(Algiers|Tunis)$/.test(tz)) return 'fr'
  if (/^Europe\/Zurich$/.test(tz)) return 'de'
  const c = country()
  if (BY_COUNTRY[c]) return BY_COUNTRY[c]
  const dev = (navigator.languages?.[0] || navigator.language || 'en').slice(0, 2).toLowerCase()
  if (ENGLISH.has(c) && /^(Europe\/(London|Dublin)|America|Australia|Pacific)/.test(tz)) return ''
  return ALL.has(dev) ? (dev as L) : ''
}
const resolve = (): '' | L => {
  const s = (getSettings() as any).uiLang || 'auto'
  if (s === 'auto') return autoLang()
  return ALL.has(s) ? (s as L) : ''
}

/** Translate one English string (also usable directly in code). */
export function t(en: string): string {
  if (!lang || !en) return en
  const i = IDX[lang]
  if (MORE.has(lang)) {
    const d2 = D2[en]
    if (d2) return d2[i]
    for (const [re, f] of P2) {
      const m = en.match(re)
      if (m) return f(m)[i]
    }
    return en
  }
  const d = D[en]
  if (d) return d[i]
  for (const [re, f] of P) {
    const m = en.match(re)
    if (m) return f(m)[i]
  }
  return en
}

// ——— On-screen translation: keeps the original English for each text node so the language can change live ———
const orig = new WeakMap<Node, string>()
const wrote = new WeakMap<Node, string>()
const ATTRS = ['placeholder', 'title', 'aria-label']
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'svg', 'path'])

function doText(n: Text) {
  const cur = n.nodeValue || ''
  let o = orig.get(n)
  if (o === undefined || cur !== wrote.get(n)) o = cur // React changed the text → new original
  orig.set(n, o)
  const s = o.trim()
  if (!s || !/[A-Za-z]/.test(s)) return
  const tr = t(s)
  const out = tr === s ? o : o.replace(s, tr)
  wrote.set(n, out)
  if (out !== cur) n.nodeValue = out
}
const attrOrig = new WeakMap<Element, Record<string, string>>()
function doAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (v == null) continue
    const rec = attrOrig.get(el) || {}
    const prevOut = rec['>' + a]
    const o = v !== prevOut || rec[a] === undefined ? v : rec[a]
    rec[a] = o
    const out = t(o)
    rec['>' + a] = out
    attrOrig.set(el, rec)
    if (out !== v) el.setAttribute(a, out)
  }
}
function walk(root: Node) {
  if (root.nodeType === 3) return doText(root as Text)
  if (root.nodeType !== 1 || SKIP.has((root as Element).nodeName)) return
  doAttrs(root as Element)
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && SKIP.has((n as Element).nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  let n: Node | null
  while ((n = tw.nextNode())) n.nodeType === 3 ? doText(n as Text) : doAttrs(n as Element)
}

let obs: MutationObserver | null = null
export function initI18n() {
  const apply = () => {
    lang = resolve()
    document.documentElement.lang = lang || 'en'
    if (document.body) walk(document.body)
  }
  apply()
  onSettings(() => {
    const before = lang
    if (resolve() !== before) apply()
  })
  if (obs) return
  obs = new MutationObserver((ms) => {
    if (!lang) {
      // English: only restore nodes that were translated before
      for (const m of ms) if (m.type === 'characterData') orig.delete(m.target)
      return
    }
    for (const m of ms) {
      if (m.type === 'childList') m.addedNodes.forEach(walk)
      else if (m.type === 'characterData') doText(m.target as Text)
      else if (m.type === 'attributes') doAttrs(m.target as Element)
    }
  })
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}
