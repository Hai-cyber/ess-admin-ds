export default {
  async fetch(_request) {
    return Response.json({
      worker: 'media-automation',
      status: 'scaffolded',
      message: 'Media automation worker scaffold.'
    });
  }
};
