export default {
  async fetch(request) {
    return Response.json({
      worker: 'media-automation',
      status: 'scaffolded',
      message: 'Media automation worker scaffold.'
    });
  }
};
