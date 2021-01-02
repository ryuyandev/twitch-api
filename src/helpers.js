const errorHandler = (err, req, res, next) => {
  if (!res.headersSent) {
    let message = err.message || 'error'
    if (!err.public && process.env.NODE_ENV === 'production')
      message = 'unhandled exception'

    res.status(err.status || 500)
      .json({ type: 'error', message })
  }

  next(err)
}

const asyncRoute = routeHandler => (req, res, next) => {
  Promise.resolve(routeHandler(req, res, next))
    .catch(err => errorHandler(err, req, res, next))
}

module.exports = {
  errorHandler,
  asyncRoute
}
