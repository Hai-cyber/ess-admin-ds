export default {
  async fetch(_request) {
    return Response.json({
      worker: 'kds',
      status: 'scaffolded',
      message: 'KDS worker scaffold.'
    });
  }
};
