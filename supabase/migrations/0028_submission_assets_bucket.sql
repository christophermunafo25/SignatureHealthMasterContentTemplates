-- v2.2: facilities now upload their own photos, videos, and documents.
-- Widen the private submissions bucket beyond the three image types the
-- template flow needed.
--
-- DEPLOY NOTE: the project's GLOBAL upload size limit (Dashboard → Storage →
-- Settings) must also be raised to at least 200 MB or this bucket limit has
-- no effect.

update storage.buckets
   set file_size_limit  = 209715200,  -- 200 MB
       allowed_mime_types = array[
         'image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif',
         'video/mp4','video/quicktime','video/webm',
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation'
       ]
 where id = 'submissions';
