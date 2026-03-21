export default {
  async fetch(request) {
    return Response.json({
      worker: 'kds',
      status: 'scaffolded',
      message: 'KDS worker scaffold.'
    });
  }
};
